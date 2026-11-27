import { BleSession } from '../session/createBleSession'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { commandRegistry, CommandContext, LorawanPingReply, LorawanRadioEvent, parseLorawanRadioLine } from '../protocol/commandRegistry'
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
 * How long a wait follows a failed attempt before giving up on the camera. The
 * camera tries a failed join or uplink again by itself, up to six times, the
 * wait doubling from 5 s to 80 s (ww-hardware stateMachine.c RETRYINTERVAL),
 * and says `Retrying transmission now.` as it does, so this allows for the
 * longest wait. Only reached when the camera says nothing (#560).
 */
export const LORAWAN_RETRY_GIVE_UP_MS = 120_000

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

/** Told the attempt number each time the camera tries again: 2 for its first retry (#560). */
export type LorawanRetryListener = (attempt: number) => void

interface RunningTest {
    result: Promise<LorawanTestResult>
    listeners: Set<LorawanRetryListener>
    /** The attempt under way, 1 until the camera retries */
    attempt: number
}

/** The test under way for each camera, so a second caller waits for it instead of starting another. */
const running = new Map<string, RunningTest>()

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
 * only for a camera that says nothing. A failed join or uplink is one attempt:
 * the camera tries again by itself and says so, and the test follows it to
 * `Joined.`, `Uplink message acknowledged.` or `... failed after N retries`
 * (#560). `onRetry` hears each new attempt, also of a test another caller
 * started. Each acknowledgement is one of the camera's 10 downlinks a day on
 * The Things Network.
 */
export function testLorawan(session: TestSession, deviceId: string, onRetry?: LorawanRetryListener): Promise<LorawanTestResult> {
    let test = running.get(deviceId)
    if (!test) {
        const created: RunningTest = { listeners: new Set(), attempt: 1, result: Promise.resolve({ outcome: 'no_answer' }) }
        const tell: LorawanRetryListener = attempt => {
            created.attempt = attempt
            created.listeners.forEach(listener => listener(attempt))
        }
        created.result = runTest(session, deviceId, tell).finally(() => running.delete(deviceId))
        running.set(deviceId, created)
        test = created
    }
    if (onRetry) {
        const listeners = test.listeners
        listeners.add(onRetry)
        if (test.attempt > 1) onRetry(test.attempt)
        const stop = () => { listeners.delete(onRetry) }
        test.result.then(stop, stop)
    }
    return test.result
}

async function runTest(session: TestSession, deviceId: string, onRetry: LorawanRetryListener): Promise<LorawanTestResult> {
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
                return await heardOrNot(radio, onRetry)
            case 'off':
            case 'not_joined':
                return await joinAndListen(session, radio, onRetry)
        }
    } finally {
        radio.close()
    }
}

async function joinAndListen(session: TestSession, radio: RadioListener, onRetry: LorawanRetryListener): Promise<LorawanTestResult> {
    const join = await ask(session, commandRegistry.join)
    log(`[LoRaWAN] join: ${join ?? 'no answer'}`)
    if (join === null) return { outcome: 'no_answer' }

    if (join === 'already_joined') {
        // The MAC says joined although the ping said not: ask once more
        const ping = await ask(session, commandRegistry.ping)
        log(`[LoRaWAN] ping after "Already joined": ${ping ?? 'no answer'}`)
        if (ping === 'sent') return await heardOrNot(radio, onRetry)
        if (ping === null) return { outcome: 'no_answer' }
        return { outcome: ping === 'busy' ? 'busy' : 'no_gateway' }
    }

    // `joining`, or `wrong_state` while a join is already under way
    const joined = await finalResult(radio, 'joined', 'join_failed', { onRetry })
    log(`[LoRaWAN] join result: ${joined.outcome}`)
    if (joined.outcome !== 'ok') return { outcome: 'no_gateway' }

    // Heard already; the camera's first packets after the join bring the signal
    const after = await uplinkResult(radio)
    return { outcome: 'heard', signal: after.signal }
}

async function heardOrNot(radio: RadioListener, onRetry: LorawanRetryListener): Promise<LorawanTestResult> {
    const result = await finalResult(radio, 'acknowledged', 'not_acknowledged', { onRetry })
    log(`[LoRaWAN] uplink result: ${result.outcome}`)
    if (result.outcome === 'silent') return { outcome: 'no_answer' }
    if (result.outcome === 'failed') return { outcome: 'not_heard' }
    return { outcome: 'heard', signal: await signalOf(radio) }
}

/**
 * What a join or an uplink came to, following the camera's own retries (#560):
 * - `ok`: `Joined.` or `Uplink message acknowledged.`, on any attempt.
 * - `failed`: `... failed after N retries`, `maxFailures` failed attempts, or
 *   silence after a failed attempt.
 * - `silent`: nothing at all.
 * Each `Retrying transmission now.` is a new attempt, told to `onRetry`.
 */
type FinalResult = { outcome: 'ok' } | { outcome: 'failed' } | { outcome: 'silent' }

async function finalResult(
    radio: RadioListener,
    ok: 'joined' | 'acknowledged',
    failed: 'join_failed' | 'not_acknowledged',
    { onRetry, maxFailures = Infinity, afterFailureGiveUpMs = LORAWAN_RETRY_GIVE_UP_MS }: {
        onRetry?: LorawanRetryListener
        maxFailures?: number
        afterFailureGiveUpMs?: number
    } = {},
): Promise<FinalResult> {
    let failures = 0
    let attempt = 1
    let afterFailure = false
    for (;;) {
        const event = await radio.next([ok, failed, 'retrying', 'gave_up'], afterFailure ? afterFailureGiveUpMs : LORAWAN_SILENCE_GIVE_UP_MS)
        if (!event) return failures > 0 ? { outcome: 'failed' } : { outcome: 'silent' }
        if (event.kind === ok) return { outcome: 'ok' }
        if (event.kind === 'gave_up') return { outcome: 'failed' }
        if (event.kind === 'retrying') {
            afterFailure = false
            attempt++
            log(`[LoRaWAN] the camera tries again, attempt ${attempt}`)
            onRetry?.(attempt)
            continue
        }
        // One failed attempt: the camera says when it tries again
        failures++
        if (failures >= maxFailures) return { outcome: 'failed' }
        afterFailure = true
    }
}

/** The signal of the downlink that acknowledged the camera's message: just before the acknowledgement, or the next line. */
async function signalOf(radio: RadioListener): Promise<LorawanSignal | undefined> {
    const before = radio.justBefore()
    const downlink = before?.kind === 'downlink' ? before : await radio.next(['downlink'], LORAWAN_SIGNAL_GIVE_UP_MS)
    if (downlink) log(`[LoRaWAN] signal: RSSI ${downlink.rssi} dBm, SNR ${downlink.snr} dB`)
    return downlink ? { rssi: downlink.rssi, snr: downlink.snr } : undefined
}

/** The camera's next uplink result, and the signal of the downlink that acknowledged it. */
async function uplinkResult(radio: RadioListener): Promise<{ acknowledged?: boolean; signal?: LorawanSignal }> {
    const result = await radio.next(['acknowledged', 'not_acknowledged'], LORAWAN_SILENCE_GIVE_UP_MS)
    log(`[LoRaWAN] uplink: ${result?.kind ?? 'nothing'}`)
    if (!result) return {}
    if (result.kind === 'not_acknowledged') return { acknowledged: false }
    return { acknowledged: true, signal: await signalOf(radio) }
}

/**
 * Ask the camera for a check-in now, as the last step of a deployment that
 * requires LoRaWAN, so its first check-in lands on the new deployment (Victor,
 * 27 Nov 2026). Start Monitoring's LoRaWAN test joins a camera whose LoRaWAN is
 * off before the deployment exists, and a camera can be joined from before;
 * when the deployment then turns LoRaWAN on, the nRF only restarts its check-in
 * timer (handleLorawanConfigChange in ww-hardware stateMachine.c), so without
 * this the first check-in would come a whole period later. A camera not joined
 * yet answers `LoRaWAN is off` or `Not joined yet.`, and sends its first
 * check-in itself straight after it joins. Only the reply is awaited, never the
 * acknowledgement, and nothing here can fail the deployment.
 */
export async function requestLorawanCheckIn(session: TestSession): Promise<LorawanPingReply | null> {
    const reply = await ask(session, commandRegistry.ping)
    log(`[LoRaWAN] check-in request: ${reply ?? 'no answer'}`)
    return reply
}

/** The deployment log's line for `requestLorawanCheckIn`'s answer. */
export function describeLorawanCheckIn(reply: LorawanPingReply | null): string {
    switch (reply) {
        case 'sent':
            return 'LoRaWAN: first check-in sent'
        case 'busy':
            return 'LoRaWAN: the camera is already sending'
        case 'off':
        case 'not_joined':
            return 'LoRaWAN: the camera sends its first check-in once it joins the network'
        case null:
            return 'LoRaWAN: no answer to the check-in request'
    }
}

/**
 * What became of the final check-in Stop Monitoring asks for (#557):
 * - `received`: the network acknowledged it.
 * - `off`: LoRaWAN is off on the camera, so there was nothing to send.
 * - `not_heard`: sent, and no gateway acknowledged it.
 * - `not_joined`: LoRaWAN is on, but the camera is not on the network.
 * - `no_answer`: the camera did not answer the request.
 */
export type LorawanFinalCheckIn = 'received' | 'off' | 'not_heard' | 'not_joined' | 'no_answer'

/**
 * Ask the camera for a final check-in as a deployment ends, and wait for the
 * network's acknowledgement, so the website learns of the collection now rather
 * than at the phone's next sync (#557). The caller ends the record only after
 * this, so the check-in falls inside the deployment. `ping` decides whether
 * there is one: the nRF answers `LoRaWAN is off` while op 32 is 0. `Busy`
 * means the camera is already sending, and that message's acknowledgement does
 * as well. `onSent` fires once a message is on its way, before the wait. A
 * first `NOT acknowledged` waits for the camera's one retry, about 5 s later,
 * then the stop carries on whatever it brings (Victor, 27 Nov 2026, #560): the
 * stop turns LoRaWAN off, which ends any further retries.
 */
export async function sendFinalLorawanCheckIn(
    session: TestSession,
    deviceId: string,
    onSent?: () => void,
): Promise<LorawanFinalCheckIn> {
    // Listening before anything is sent: the camera's lines can follow its reply at once
    const radio = listenToRadio(deviceId)
    try {
        const reply = await ask(session, commandRegistry.ping)
        log(`[LoRaWAN] final check-in request: ${reply ?? 'no answer'}`)
        if (reply === null) return 'no_answer'
        if (reply === 'off' || reply === 'not_joined') return reply

        onSent?.()
        const result = await finalResult(radio, 'acknowledged', 'not_acknowledged', {
            maxFailures: 2,
            afterFailureGiveUpMs: LORAWAN_SILENCE_GIVE_UP_MS,
        })
        log(`[LoRaWAN] final check-in: ${result.outcome}`)
        return result.outcome === 'ok' ? 'received' : 'not_heard'
    } finally {
        radio.close()
    }
}

/** The deployment log's line for a final check-in, or null when LoRaWAN is off. */
export function describeFinalLorawanCheckIn(outcome: LorawanFinalCheckIn): string | null {
    switch (outcome) {
        case 'received':
            return 'LoRaWAN: final check-in received'
        case 'off':
            return null
        case 'not_heard':
            return 'LoRaWAN: the final check-in did not get through, no gateway acknowledged it'
        case 'not_joined':
            return 'LoRaWAN: the final check-in did not get through, the camera is not on the network'
        case 'no_answer':
            return 'LoRaWAN: the final check-in did not get through, the camera did not answer'
    }
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

/** The LoRaWAN Signal popup's words while the camera tries again (#560). */
export function lorawanRetryWords(attempt: number): { status: string; detail: string } {
    return {
        status: 'Not heard yet',
        detail: `The camera is trying again (attempt ${attempt}). It keeps trying for a few minutes and says when it gets through or stops. You can close this: the result shows on the row.`,
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

/** Start Monitoring's warning while the camera tries again to reach the network; the result replaces it (#560). */
export function lorawanRetryingWarning(attempt: number): string {
    return `${LORAWAN_REQUIRED_WARNING} and the network has not answered yet: the camera is trying again (attempt ${attempt}).`
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
