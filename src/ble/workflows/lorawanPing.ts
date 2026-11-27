import { BleSession } from '../session/createBleSession'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { commandRegistry, CommandContext, LorawanRadioEvent, parseLorawanRadioLine } from '../protocol/commandRegistry'
import { log, logWarn } from '../../utils/logger'

/** The gateway's signal at the camera, from the downlink that acknowledged its message. */
export interface LorawanSignal {
    rssi: number
    snr: number
}

/**
 * What the LoRaWAN test found (#552):
 * - `heard`: the network answered the camera, by a join accept or by
 *   acknowledging its message. `signal` comes with an acknowledgement.
 * - `no_gateway`: the camera asked to join and nothing answered.
 * - `not_heard`: the camera sent its test message and nothing acknowledged it.
 * - `busy`: the camera is on the network, but its radio was already sending.
 * - `no_answer`: the camera did not answer a command, or said nothing after it.
 */
export type LorawanTestOutcome = 'heard' | 'no_gateway' | 'not_heard' | 'busy' | 'no_answer'

export interface LorawanTestResult {
    outcome: LorawanTestOutcome
    signal?: LorawanSignal
}

/**
 * How long the test waits on a camera that says nothing. Only reached then:
 * every step waits for the camera's own line. On the bench a join was answered
 * in about 6 s (WILD-W3CL, 27 Nov 2026), and an uplink was acknowledged within
 * 5 s or reported NOT acknowledged within 9 s (Charles's logs, Nov 2026).
 */
export const LORAWAN_SILENCE_GIVE_UP_MS = 30_000

/**
 * How long the test waits for the downlink line after an acknowledgement, which
 * followed it by about 12 ms on the bench. Without it the result has no signal.
 */
export const LORAWAN_SIGNAL_GIVE_UP_MS = 5_000

/**
 * Below either, the signal is weak: SNR -7 dB is about where the fastest data
 * rate (SF7) stops decoding, so the network moves the camera to slower rates
 * that cost airtime and battery, and -115 dBm leaves little margin above what
 * the radio can hear. To be settled with field results (#552).
 */
export const WEAK_RSSI_DBM = -115
export const WEAK_SNR_DB = -7

export const isWeakSignal = ({ rssi, snr }: LorawanSignal): boolean => rssi < WEAK_RSSI_DBM || snr < WEAK_SNR_DB

type TestSession = Pick<BleSession, 'execute'>

/** The test under way for each camera, so a second caller waits for it instead of starting another. */
const running = new Map<string, Promise<LorawanTestResult>>()

/**
 * Test whether the LoRaWAN network hears the camera, with no phone internet and
 * no change to the camera's settings (#552). The LoRaWAN Signal row and Start
 * Monitoring's own check both come here, so they can never read the camera
 * differently (#348), and a test already under way for the camera is shared.
 *
 * 1. `ping`. `OK` sends a confirmed uplink; wait for its acknowledgement.
 * 2. `LoRaWAN is off` or `Not joined yet.`: `join`, which joins once even
 *    while LoRaWAN is off, and wait for `Joined.` or `Failed to join.`. A join
 *    accept comes from the network server, so `Joined.` is heard. The camera
 *    then sends its own confirmed packets, whose acknowledgement gives the
 *    signal.
 *
 * Each step waits for the camera's line, never a set time; the give-ups are
 * only for a camera that says nothing. Each acknowledgement is one of the
 * camera's 10 downlinks a day on The Things Network.
 */
export function testLorawan(session: TestSession, deviceId: string): Promise<LorawanTestResult> {
    const already = running.get(deviceId)
    if (already) return already
    const test = runTest(session, deviceId).finally(() => running.delete(deviceId))
    running.set(deviceId, test)
    return test
}

async function runTest(session: TestSession, deviceId: string): Promise<LorawanTestResult> {
    // Listening before anything is sent: the camera's lines can follow its reply at once
    const radio = listenToRadio(deviceId)
    try {
        const ping = await ask(session, commandRegistry.ping)
        log(`[LoRaWAN] ping: ${ping ?? 'no answer'}`)
        switch (ping) {
            case null:
                return { outcome: 'no_answer' }
            case 'busy':
                return { outcome: 'busy' }
            case 'sent':
                return await heardOrNot(radio)
            case 'off':
            case 'not_joined':
                return await joinAndListen(session, radio)
        }
    } finally {
        radio.close()
    }
}

async function joinAndListen(session: TestSession, radio: RadioListener): Promise<LorawanTestResult> {
    const join = await ask(session, commandRegistry.join)
    log(`[LoRaWAN] join: ${join ?? 'no answer'}`)
    if (join === null) return { outcome: 'no_answer' }

    if (join === 'already_joined') {
        // The MAC says joined although the ping said not: ask once more
        const ping = await ask(session, commandRegistry.ping)
        log(`[LoRaWAN] ping after "Already joined": ${ping ?? 'no answer'}`)
        if (ping === 'sent') return await heardOrNot(radio)
        if (ping === null) return { outcome: 'no_answer' }
        return { outcome: ping === 'busy' ? 'busy' : 'no_gateway' }
    }

    // `joining`, or `wrong_state` while a join is already under way
    const joined = await radio.next(['joined', 'join_failed'], LORAWAN_SILENCE_GIVE_UP_MS)
    log(`[LoRaWAN] join result: ${joined?.kind ?? 'nothing'}`)
    if (joined?.kind !== 'joined') return { outcome: 'no_gateway' }

    // Heard already; the camera's first packets after the join bring the signal
    const after = await uplinkResult(radio)
    return { outcome: 'heard', signal: after.signal }
}

async function heardOrNot(radio: RadioListener): Promise<LorawanTestResult> {
    const result = await uplinkResult(radio)
    if (result.acknowledged === undefined) return { outcome: 'no_answer' }
    return result.acknowledged ? { outcome: 'heard', signal: result.signal } : { outcome: 'not_heard' }
}

/** The camera's next uplink result, and the signal of the downlink that acknowledged it. */
async function uplinkResult(radio: RadioListener): Promise<{ acknowledged?: boolean; signal?: LorawanSignal }> {
    const result = await radio.next(['acknowledged', 'not_acknowledged'], LORAWAN_SILENCE_GIVE_UP_MS)
    log(`[LoRaWAN] uplink: ${result?.kind ?? 'nothing'}`)
    if (!result) return {}
    if (result.kind === 'not_acknowledged') return { acknowledged: false }

    // The acknowledgement's own downlink line: just before it, or else the next one
    const before = radio.justBefore()
    const downlink = before?.kind === 'downlink' ? before : await radio.next(['downlink'], LORAWAN_SIGNAL_GIVE_UP_MS)
    if (downlink) log(`[LoRaWAN] signal: RSSI ${downlink.rssi} dBm, SNR ${downlink.snr} dB`)
    return { acknowledged: true, signal: downlink ? { rssi: downlink.rssi, snr: downlink.snr } : undefined }
}

/** A command's answer, or null when the camera gave none. */
async function ask<T>(session: TestSession, command: () => CommandContext<T>): Promise<T | null> {
    try {
        return await session.execute(command)
    } catch (err) {
        logWarn('[LoRaWAN] No answer:', err)
        return null
    }
}

type RadioKind = LorawanRadioEvent['kind']

interface RadioListener {
    /** The next unread line of one of `kinds`, reading past the others; null after `giveUpMs` with none. */
    next: <K extends RadioKind>(kinds: K[], giveUpMs: number) => Promise<Extract<LorawanRadioEvent, { kind: K }> | null>
    /** The line before the one `next` last returned. */
    justBefore: () => LorawanRadioEvent | null
    close: () => void
}

/** The camera's unasked LoRaWAN lines (`parseLorawanRadioLine`), kept in order from now on. */
function listenToRadio(deviceId: string): RadioListener {
    const heard: LorawanRadioEvent[] = []
    let unread = 0
    let wake: (() => void) | null = null

    const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== deviceId) return
        const radioEvent = parseLorawanRadioLine(event.line)
        if (!radioEvent) return
        heard.push(radioEvent)
        wake?.()
    }
    bleEventBus.on('textLine', onLine)

    const next = async <K extends RadioKind>(kinds: K[], giveUpMs: number) => {
        const giveUpAt = Date.now() + giveUpMs
        for (;;) {
            while (unread < heard.length) {
                const event = heard[unread++]
                if ((kinds as RadioKind[]).includes(event.kind)) return event as Extract<LorawanRadioEvent, { kind: K }>
            }
            const left = giveUpAt - Date.now()
            if (left <= 0) return null
            await new Promise<void>(resolve => {
                const timer = setTimeout(() => { wake = null; resolve() }, left)
                wake = () => { clearTimeout(timer); wake = null; resolve() }
            })
        }
    }

    return {
        next,
        justBefore: () => heard[unread - 2] ?? null,
        close: () => bleEventBus.removeListener('textLine', onLine),
    }
}

/** The LoRaWAN Signal row's words for a result. */
export function lorawanTestWords(result: LorawanTestResult): { status: string; detail: string } {
    switch (result.outcome) {
        case 'heard': {
            if (!result.signal) {
                return { status: 'Heard by the network', detail: 'A gateway heard the camera and the network answered it.' }
            }
            const numbers = `RSSI ${result.signal.rssi} dBm, SNR ${result.signal.snr} dB`
            return isWeakSignal(result.signal)
                ? {
                    status: 'Weak signal',
                    detail: `The network heard the camera, but the signal is weak (${numbers}), so some of its messages may be lost. Try the camera, or the gateway, higher or closer, then test again.`,
                }
                : { status: 'Heard by the network', detail: `A gateway heard the camera and the network answered it. Signal good (${numbers}).` }
        }
        case 'no_gateway':
            return {
                status: 'No gateway answered',
                detail: 'The camera asked to join the LoRaWAN network and nothing answered. Check a gateway is on and in range, then test again. If a gateway is close and nothing answers, the camera may not be registered for LoRaWAN: contact wildlife.ai.',
            }
        case 'not_heard':
            return {
                status: 'Not heard',
                detail: 'The camera sent a test message and no gateway acknowledged it. Check a gateway is on and in range, then test again.',
            }
        case 'busy':
            return {
                status: 'Busy',
                detail: 'The camera is on the network, but its radio is already sending, so no test message went out. Test again in a minute.',
            }
        case 'no_answer':
            return {
                status: 'No answer',
                detail: 'The camera did not answer the test. Check it is still connected, then test again.',
            }
    }
}

/** Every Start Monitoring warning about the LoRaWAN test starts with this, so the screen can clear its own. */
export const LORAWAN_REQUIRED_WARNING = 'LoRaWAN is required'

/**
 * Start Monitoring's warning for a project that requires LoRaWAN, or null when
 * the network heard the camera well. A warning never stops the deployment
 * (Victor, 27 Nov 2026). `busy` is on the network: the nRF only checks its
 * radio once it has joined.
 */
export function lorawanRequiredWarning(result: LorawanTestResult): string | null {
    switch (result.outcome) {
        case 'heard':
            return result.signal && isWeakSignal(result.signal)
                ? `${LORAWAN_REQUIRED_WARNING} but the signal is weak, so some of the camera's messages may be lost.`
                : null
        case 'busy':
            return null
        case 'no_gateway':
            return `${LORAWAN_REQUIRED_WARNING} but no gateway answered the camera.`
        case 'not_heard':
            return `${LORAWAN_REQUIRED_WARNING} but no gateway heard the camera's test message.`
        case 'no_answer':
            return `${LORAWAN_REQUIRED_WARNING} but the camera did not answer the network test.`
    }
}

/** Start Monitoring's warning for a camera with no DevEUI on its record starts with this. */
export const LORAWAN_REGISTRATION_WARNING = 'This camera is not registered for LoRaWAN'

/**
 * Start Monitoring's warning, in a project that requires LoRaWAN, for a camera
 * whose record has no DevEUI: the server links a camera's messages by it, so
 * none would reach the project (#552, ww-website#525). The record comes down
 * with every pull, so this works offline.
 */
export function lorawanRegistrationWarning(deviceEui: string | null | undefined): string | null {
    return deviceEui
        ? null
        : `${LORAWAN_REGISTRATION_WARNING}, so its messages will not reach the project. Contact wildlife.ai.`
}
