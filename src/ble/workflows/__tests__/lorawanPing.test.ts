import {
    testLorawan, lorawanTestWords, requestLorawanCheckIn, describeLorawanCheckIn, sendFinalLorawanCheckIn, describeFinalLorawanCheckIn,
    LorawanFinalCheckIn, lorawanRequiredWarning, lorawanRegistrationWarning, LorawanTestResult,
    LORAWAN_REQUIRED_WARNING, LORAWAN_REGISTRATION_WARNING, LORAWAN_SILENCE_GIVE_UP_MS, LORAWAN_SIGNAL_GIVE_UP_MS,
    LORAWAN_RETRY_GIVE_UP_MS, lorawanRetryWords, lorawanRetryingWarning,
} from '../lorawanPing'
import { bleEventBus } from '../../protocol/eventBus'
import { parseLorawanRadioLine } from '../../protocol/commandRegistry'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

const CAMERA = 'F5:3F:88:C6:81:06'

/** The camera sends a line over Bluetooth. */
const say = (line: string, deviceId = CAMERA) => bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId })

/**
 * A camera that answers each command with the next step's reply, through the
 * real command, then sends that step's unasked lines, as the nRF does.
 */
const camera = (steps: { reply: string | Error; then?: string[] }[]) => {
    const sent: string[] = []
    const session = {
        execute: jest.fn(async (factory: any) => {
            const command = factory()
            sent.push(command.build())
            const step = steps.shift()
            if (!step) throw new Error(`No reply scripted for ${command.build()}`)
            if (step.reply instanceof Error) throw step.reply
            command.collect(step.reply)
            const result = command.parser()
            setTimeout(() => step.then?.forEach(line => say(line)), 0)
            return result
        }),
    }
    return { session, sent }
}

const ACK = 'Uplink message acknowledged.'
const NACK = 'Uplink message NOT acknowledged.'
const downlink = (rssi: number, snr: number) => `Downlink message. RSSI=${rssi}dBm SNR=${snr}dB. Rx 0 bytes.`
const OFF = "LoRaWAN is off. Use 'AI setop 32 <minutes>' or 'join'"
// The nRF's own retries (ww-hardware stateMachine.c, #560)
const RETRY = 'Retrying transmission now.'
const JOIN_GAVE_UP = 'Join failed after 6 retries. Pings are off, so no automatic retry.'
const UPLINK_GAVE_UP = 'Uplink failed after 6 retries. Ping timer will try again in 4h.'

// Every test runs on fake timers (tests/setup/sanitySetup.ts)
afterEach(async () => {
    // Let a test still waiting on its camera finish, so the next one is not handed it
    await jest.advanceTimersByTimeAsync(3 * LORAWAN_RETRY_GIVE_UP_MS)
})

/**
 * The test's result 10 ms after it starts. The camera's lines come at 0 ms, so a
 * result here was read from them, not from a give-up running out.
 */
const resultSoon = async (test: Promise<LorawanTestResult>) => {
    let result: LorawanTestResult | undefined
    test.then(r => { result = r })
    await jest.advanceTimersByTimeAsync(10)
    return result
}

describe('testLorawan', () => {
    it('is heard, with the signal, when the network acknowledges the test message', async () => {
        const { session, sent } = camera([{ reply: 'OK', then: [ACK, downlink(-85, 7)] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -85, snr: 7 } })
        expect(sent).toEqual(['ping'])
    })

    it('takes the signal from a downlink line that came just before the acknowledgement', async () => {
        const { session } = camera([{ reply: 'OK', then: [downlink(-90, 4), ACK] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -90, snr: 4 } })
    })

    it('is not heard when the camera stops trying without an acknowledgement', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK, RETRY, NACK, UPLINK_GAVE_UP] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'not_heard' })
    })

    // #560: each NOT acknowledged is one attempt; the camera tries again by itself
    it('follows the camera to an acknowledgement on a later attempt, and tells each attempt', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK, RETRY, ACK, downlink(-69, 9)] }])
        const onRetry = jest.fn()
        expect(await resultSoon(testLorawan(session, CAMERA, onRetry))).toEqual({ outcome: 'heard', signal: { rssi: -69, snr: 9 } })
        expect(onRetry).toHaveBeenCalledWith(2)
    })

    it('waits out the camera\'s retry interval after a failed attempt, not the 30 s for silence', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK] }])
        let result: LorawanTestResult | undefined
        testLorawan(session, CAMERA).then(r => { result = r })
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS + 1000)
        expect(result).toBeUndefined()
        say(RETRY)
        say(ACK)
        await jest.advanceTimersByTimeAsync(LORAWAN_SIGNAL_GIVE_UP_MS + 1)
        expect(result).toEqual({ outcome: 'heard', signal: undefined })
    })

    it('is not heard when the camera says nothing more after a failed attempt', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK] }])
        const test = testLorawan(session, CAMERA)
        await jest.advanceTimersByTimeAsync(LORAWAN_RETRY_GIVE_UP_MS + 1)
        expect(await test).toEqual({ outcome: 'not_heard' })
    })

    it('joins once a camera whose LoRaWAN is off, and is heard on the join, with the signal of its next packet', async () => {
        const { session, sent } = camera([
            { reply: OFF },
            { reply: 'OK (one-off join, LoRaWAN is off)', then: ['Joined.', ACK, downlink(-100, -2)] },
        ])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -100, snr: -2 } })
        expect(sent).toEqual(['ping', 'join'])
    })

    it('says no gateway answered when the camera stops trying to join', async () => {
        const { session } = camera([{ reply: 'Not joined yet.' }, { reply: 'OK', then: ['Failed to join.', JOIN_GAVE_UP] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'no_gateway' })
    })

    it('is heard when the camera joins on a later attempt (#560)', async () => {
        const { session } = camera([
            { reply: OFF },
            { reply: 'OK (one-off join, LoRaWAN is off)', then: ['Failed to join.', RETRY, 'Joined.', ACK, downlink(-68, 9)] },
        ])
        const onRetry = jest.fn()
        expect(await resultSoon(testLorawan(session, CAMERA, onRetry))).toEqual({ outcome: 'heard', signal: { rssi: -68, snr: 9 } })
        expect(onRetry).toHaveBeenCalledWith(2)
    })

    it('waits for a join already under way', async () => {
        const { session } = camera([{ reply: 'Not joined yet.' }, { reply: 'Wrong state: JOINING', then: ['Joined.', ACK, downlink(-70, 9)] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -70, snr: 9 } })
    })

    it('pings once more when the join says the camera has already joined', async () => {
        const { session, sent } = camera([
            { reply: 'Not joined yet.' },
            { reply: 'Already joined' },
            { reply: 'OK', then: [ACK, downlink(-80, 6)] },
        ])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -80, snr: 6 } })
        expect(sent).toEqual(['ping', 'join', 'ping'])
    })

    it('is heard without a signal when the camera joins and then says nothing more', async () => {
        const { session } = camera([{ reply: OFF }, { reply: 'OK (one-off join, LoRaWAN is off)', then: ['Joined.'] }])
        const test = testLorawan(session, CAMERA)
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS + 1)
        expect(await test).toEqual({ outcome: 'heard', signal: undefined })
    })

    it('is heard without a signal when no downlink line follows the acknowledgement', async () => {
        const { session } = camera([{ reply: 'OK', then: [ACK] }])
        const test = testLorawan(session, CAMERA)
        await jest.advanceTimersByTimeAsync(LORAWAN_SIGNAL_GIVE_UP_MS + 1)
        expect(await test).toEqual({ outcome: 'heard', signal: undefined })
    })

    it('says no gateway answered when nothing comes of the join', async () => {
        const { session } = camera([{ reply: 'Not joined yet.' }, { reply: 'OK' }])
        const test = testLorawan(session, CAMERA)
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS + 1)
        expect(await test).toEqual({ outcome: 'no_gateway' })
    })

    it("reads only this camera's lines, and gives up when its own never come", async () => {
        const { session } = camera([{ reply: 'OK' }])
        const test = testLorawan(session, CAMERA)
        say(ACK, 'another camera')
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS + 1)
        expect(await test).toEqual({ outcome: 'no_answer' })
    })

    it('reports busy as the camera said it', async () => {
        const { session } = camera([{ reply: 'Busy' }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'busy' })
    })

    it('reports no answer when the camera does not answer the ping, or the join', async () => {
        expect(await resultSoon(testLorawan(camera([{ reply: new Error('TIMEOUT') }]).session, CAMERA))).toEqual({ outcome: 'no_answer' })
        expect(await resultSoon(testLorawan(camera([{ reply: OFF }, { reply: new Error('TIMEOUT') }]).session, CAMERA))).toEqual({ outcome: 'no_answer' })
    })

    it('shares a test already under way for the camera, so the camera is asked once', async () => {
        const { session, sent } = camera([{ reply: 'OK', then: [ACK, downlink(-85, 7)] }])
        const first = testLorawan(session, CAMERA)
        const second = testLorawan(session, CAMERA)
        expect(second).toBe(first)
        expect(await resultSoon(first)).toEqual({ outcome: 'heard', signal: { rssi: -85, snr: 7 } })
        expect(sent).toEqual(['ping'])
    })

    it('tells a second caller the attempts of the test it shares', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK, RETRY] }])
        const first = testLorawan(session, CAMERA)
        await jest.advanceTimersByTimeAsync(10)
        const lateCaller = jest.fn()
        expect(testLorawan(session, CAMERA, lateCaller)).toBe(first)
        expect(lateCaller).toHaveBeenCalledWith(2)
        say(ACK)
        await jest.advanceTimersByTimeAsync(LORAWAN_SIGNAL_GIVE_UP_MS + 1)
        expect((await first).outcome).toBe('heard')
    })

    it('stops listening when the test ends', async () => {
        const before = bleEventBus.listenerCount('textLine')
        expect(await resultSoon(testLorawan(camera([{ reply: 'OK', then: [NACK, UPLINK_GAVE_UP] }]).session, CAMERA))).toEqual({ outcome: 'not_heard' })
        expect(bleEventBus.listenerCount('textLine')).toBe(before)
    })
})

describe('what each result tells the operator', () => {
    const good: LorawanTestResult = { outcome: 'heard', signal: { rssi: -85, snr: 7 } }
    const weak: LorawanTestResult = { outcome: 'heard', signal: { rssi: -118, snr: -9 } }
    const results: LorawanTestResult[] = [
        good, weak, { outcome: 'no_gateway' }, { outcome: 'not_heard' }, { outcome: 'busy' }, { outcome: 'no_answer' },
    ]

    it('gives every result its own status on the LoRaWAN Signal row', () => {
        const statuses = results.map(result => lorawanTestWords(result).status)
        expect(new Set(statuses).size).toBe(results.length)
    })

    it('shows the signal, and says when it is weak', () => {
        expect(lorawanTestWords(good).detail).toContain('Signal good (RSSI -85 dBm, SNR 7 dB)')
        expect(lorawanTestWords(weak).status).toBe('Weak signal')
        expect(lorawanTestWords({ outcome: 'heard' }).status).toBe('Heard by the network')
    })

    it('never sends a field user to a LoRaWAN server of their own', () => {
        for (const result of results) expect(lorawanTestWords(result).detail).not.toMatch(/your LoRaWAN server/i)
    })

    it('warns Start Monitoring unless the network heard the camera well', () => {
        expect(lorawanRequiredWarning(good)).toBeNull()
        expect(lorawanRequiredWarning({ outcome: 'heard' })).toBeNull()
        expect(lorawanRequiredWarning({ outcome: 'busy' })).toBeNull()
        const warnings = [weak, { outcome: 'no_gateway' }, { outcome: 'not_heard' }, { outcome: 'no_answer' }]
            .map(result => lorawanRequiredWarning(result as LorawanTestResult))
        for (const warning of warnings) expect(warning?.startsWith(LORAWAN_REQUIRED_WARNING)).toBe(true)
        expect(new Set(warnings).size).toBe(4)
    })

    it('says the camera is trying again, and the warning is replaced by the result (#560)', () => {
        expect(lorawanRetryWords(3)).toEqual({ status: 'Not heard yet', detail: expect.stringContaining('attempt 3') })
        expect(lorawanRetryingWarning(2).startsWith(LORAWAN_REQUIRED_WARNING)).toBe(true)
        expect(lorawanRetryingWarning(2)).toContain('attempt 2')
    })

    it('reads the camera\'s retry and give-up lines', () => {
        expect(parseLorawanRadioLine(RETRY)).toEqual({ kind: 'retrying' })
        expect(parseLorawanRadioLine(JOIN_GAVE_UP)).toEqual({ kind: 'gave_up', retries: 6 })
        expect(parseLorawanRadioLine(UPLINK_GAVE_UP)).toEqual({ kind: 'gave_up', retries: 6 })
        expect(parseLorawanRadioLine('Empty packet failed after 6 retries. Sending a ping in 5s.')).toEqual({ kind: 'gave_up', retries: 6 })
    })

    it('warns about a camera with no DevEUI on its record', () => {
        expect(lorawanRegistrationWarning(undefined)?.startsWith(LORAWAN_REGISTRATION_WARNING)).toBe(true)
        expect(lorawanRegistrationWarning('')?.startsWith(LORAWAN_REGISTRATION_WARNING)).toBe(true)
        expect(lorawanRegistrationWarning('3B4AFAFEFFDA68D8')).toBeNull()
    })
})

// The deployment's last step: the first check-in on the new deployment
describe('sendFinalLorawanCheckIn (#557)', () => {
    /** The outcome 10 ms after it starts, or undefined while it still waits. */
    const outcomeSoon = async (checkIn: Promise<LorawanFinalCheckIn>) => {
        let outcome: LorawanFinalCheckIn | undefined
        checkIn.then(o => { outcome = o })
        await jest.advanceTimersByTimeAsync(10)
        return outcome
    }

    it('is received when the network acknowledges the ping', async () => {
        const { session, sent } = camera([{ reply: 'OK', then: [downlink(-85, 7), ACK] }])
        const onSent = jest.fn()
        expect(await outcomeSoon(sendFinalLorawanCheckIn(session, CAMERA, onSent))).toBe('received')
        expect(sent).toEqual(['ping'])
        expect(onSent).toHaveBeenCalledTimes(1)
    })

    it('waits for the acknowledgement of a camera already sending', async () => {
        const { session } = camera([{ reply: 'Busy', then: [ACK] }])
        expect(await outcomeSoon(sendFinalLorawanCheckIn(session, CAMERA))).toBe('received')
    })

    // #560, Victor 27 Nov 2026: one retry, then the stop carries on
    it('waits for the camera\'s one retry after a first NOT acknowledged', async () => {
        expect(await outcomeSoon(sendFinalLorawanCheckIn(camera([{ reply: 'OK', then: [NACK, RETRY, ACK] }]).session, CAMERA))).toBe('received')
    })

    it('is not heard when the retry fails too, and waits for no more', async () => {
        expect(await outcomeSoon(sendFinalLorawanCheckIn(camera([{ reply: 'OK', then: [NACK, RETRY, NACK] }]).session, CAMERA))).toBe('not_heard')
    })

    it('carries on after 30 s when no retry comes', async () => {
        let outcome: LorawanFinalCheckIn | undefined
        sendFinalLorawanCheckIn(camera([{ reply: 'OK', then: [NACK] }]).session, CAMERA).then(o => { outcome = o })
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS + 20)
        expect(outcome).toBe('not_heard')
    })

    it('is not heard when nothing comes back', async () => {
        let outcome: LorawanFinalCheckIn | undefined
        sendFinalLorawanCheckIn(camera([{ reply: 'OK' }]).session, CAMERA).then(o => { outcome = o })
        await jest.advanceTimersByTimeAsync(LORAWAN_SILENCE_GIVE_UP_MS - 10)
        expect(outcome).toBeUndefined()
        await jest.advanceTimersByTimeAsync(20)
        expect(outcome).toBe('not_heard')
    })

    it('sends and waits for nothing while LoRaWAN is off or not joined, or when the camera does not answer', async () => {
        for (const [reply, expected] of [[OFF, 'off'], ['Not joined yet.', 'not_joined'], [new Error('TIMEOUT'), 'no_answer']] as const) {
            const onSent = jest.fn()
            expect(await outcomeSoon(sendFinalLorawanCheckIn(camera([{ reply }]).session, CAMERA, onSent))).toBe(expected)
            expect(onSent).not.toHaveBeenCalled()
        }
    })

    it('logs nothing while LoRaWAN is off, and says when the check-in did not get through', () => {
        expect(describeFinalLorawanCheckIn('received')).toBe('LoRaWAN: final check-in received')
        expect(describeFinalLorawanCheckIn('off')).toBeNull()
        for (const outcome of ['not_heard', 'not_joined', 'no_answer'] as const) {
            expect(describeFinalLorawanCheckIn(outcome)).toMatch(/^LoRaWAN: the final check-in did not get through, /)
        }
    })
})

describe('requestLorawanCheckIn', () => {
    it("sends a ping and returns the camera's reply, without waiting for the acknowledgement", async () => {
        const { session, sent } = camera([{ reply: 'OK' }])
        expect(await requestLorawanCheckIn(session)).toBe('sent')
        expect(sent).toEqual(['ping'])
    })

    it('never throws: no answer is null', async () => {
        expect(await requestLorawanCheckIn(camera([{ reply: new Error('TIMEOUT') }]).session)).toBeNull()
    })

    it('logs what each reply means for the first check-in', () => {
        expect(describeLorawanCheckIn('sent')).toBe('LoRaWAN: first check-in sent')
        expect(describeLorawanCheckIn('off')).toBe(describeLorawanCheckIn('not_joined'))
        expect(describeLorawanCheckIn('off')).toMatch(/once it joins/)
        expect(new Set((['sent', 'busy', 'off', null] as const).map(describeLorawanCheckIn)).size).toBe(4)
    })
})
