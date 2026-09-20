/**
 * awaitAeRegisters: wait for the device's unprompted `HM0360 AE regs` block.
 *
 * `AI light` is two-phase and must never be awaited for its answer: it replies
 * `Checking light level...` as an acknowledgement only, and the reading follows
 * about a second later as telemetry. A blocking variant deadlocked over BLE,
 * because the firmware's I2C receive state does not clear until the CLI replies
 * while the telemetry send needs the same link free, so do not ask for one.
 *
 * This is the wait that makes the two-phase command usable. It lived inside
 * `useLightSensor` until the deployment pipeline needed the same thing to read
 * the light without taking a photo (#304); one implementation means the two
 * callers cannot drift on what counts as a complete block.
 */

import { AEData, grabAeFields } from '../../utils/aeRegisters'
import { bleEventBus, BleEvent } from './eventBus'
import { parseLightCheck } from './lightCheck'
import { log } from '../../utils/logger'

/**
 * Ceiling for a whole light measurement: the command's own 8s allowance (the AI
 * processor may need a DPD wake first) plus the light check itself, with
 * headroom. Only reached when something is actually wrong.
 */
export const LIGHT_CHECK_TIMEOUT_MS = 15_000

/**
 * Wait for the next complete `HM0360 AE regs` block from this device. Resolves
 * null on timeout, or when cancelled.
 *
 * Subscribe before the command is sent, deliberately. `AI light` is
 * acknowledged immediately and the block follows about a second later, but
 * nothing guarantees that ordering under a slow render or a busy queue, and a
 * listener attached after the send could miss it entirely.
 *
 * The decision line, when the firmware sends one, arrives *before* the block
 * (lightSensor.c queues it inside the light check; image_task.c queues the
 * registers afterwards), so by the time this resolves any passive listener has
 * already recorded it.
 *
 * `cancel` matters on the paths that abandon the wait, such as firmware that
 * does not know the command: without it the listener would sit on a shared event
 * bus until the timeout, ready to consume a block meant for someone else.
 */
export const awaitAeRegisters = (deviceId: string, timeoutMs: number = LIGHT_CHECK_TIMEOUT_MS) => {
    let settle!: (result: AEData | null) => void
    const promise = new Promise<AEData | null>(resolve => { settle = resolve })
    let collected: AEData | null = null

    const done = (result: AEData | null) => {
        clearTimeout(timer)
        bleEventBus.removeListener('textLine', listener)
        settle(result)
    }
    const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== deviceId) return
        // The decision line also says "analog gain = 4" in one of its wordings,
        // which would otherwise be lifted into a half-built block.
        if (parseLightCheck(event.line)) return
        const next = grabAeFields(event.line, collected)
        if (!next) return
        collected = next
        if (collected.aeConverged !== '' && collected.aeMean !== '') {
            // Timing marker for the bench log: on the 2 September stream the
            // caller acted on this block up to a second after it arrived, and
            // this line says whether the wait was here or on the command's own
            // acknowledgement (logged as "light acked" by the caller).
            log('[LightSensor] registers complete')
            done(collected)
        }
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    bleEventBus.on('textLine', listener)

    return { promise, cancel: () => done(null) }
}
