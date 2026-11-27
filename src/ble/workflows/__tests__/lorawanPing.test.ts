import {
    testLorawan, lorawanTestWords, lorawanRequiredWarning, lorawanRegistrationWarning, LorawanTestResult,
    LORAWAN_REQUIRED_WARNING, LORAWAN_REGISTRATION_WARNING, LORAWAN_SILENCE_GIVE_UP_MS, LORAWAN_SIGNAL_GIVE_UP_MS,
} from '../lorawanPing'
import { bleEventBus } from '../../protocol/eventBus'

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

// Every test runs on fake timers (tests/setup/sanitySetup.ts)
afterEach(async () => {
    // Let a test still waiting on its camera finish, so the next one is not handed it
    await jest.advanceTimersByTimeAsync(3 * LORAWAN_SILENCE_GIVE_UP_MS)
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

    it('is not heard when nothing acknowledges the test message', async () => {
        const { session } = camera([{ reply: 'OK', then: [NACK] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'not_heard' })
    })

    it('joins once a camera whose LoRaWAN is off, and is heard on the join, with the signal of its next packet', async () => {
        const { session, sent } = camera([
            { reply: OFF },
            { reply: 'OK (one-off join, LoRaWAN is off)', then: ['Joined.', ACK, downlink(-100, -2)] },
        ])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'heard', signal: { rssi: -100, snr: -2 } })
        expect(sent).toEqual(['ping', 'join'])
    })

    it('says no gateway answered when the join fails', async () => {
        const { session } = camera([{ reply: 'Not joined yet.' }, { reply: 'OK', then: ['Failed to join.'] }])
        expect(await resultSoon(testLorawan(session, CAMERA))).toEqual({ outcome: 'no_gateway' })
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

    it('stops listening when the test ends', async () => {
        const before = bleEventBus.listenerCount('textLine')
        expect(await resultSoon(testLorawan(camera([{ reply: 'OK', then: [NACK] }]).session, CAMERA))).toEqual({ outcome: 'not_heard' })
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

    it('warns about a camera with no DevEUI on its record', () => {
        expect(lorawanRegistrationWarning(undefined)?.startsWith(LORAWAN_REGISTRATION_WARNING)).toBe(true)
        expect(lorawanRegistrationWarning('')?.startsWith(LORAWAN_REGISTRATION_WARNING)).toBe(true)
        expect(lorawanRegistrationWarning('3B4AFAFEFFDA68D8')).toBeNull()
    })
})
