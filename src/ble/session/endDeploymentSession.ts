import type { CommandContext } from '../protocol/commandRegistry'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { createBleSession } from './createBleSession'
import { logWarn } from '../../utils/logger'

/**
 * The most the camera's steps of ending a deployment may take together.
 *
 * A healthy end is a few seconds: the first command pays one DPD wake, about a
 * second on the bench, and the rest follow while the camera is awake. Twenty
 * leaves room for a second wake if the camera sleeps between steps. A camera
 * that does not answer at all is given up on well before this, after the probe.
 */
export const END_DEPLOYMENT_BUDGET_MS = 20_000

/** Why a skipped step failed. Worded so `quiesceDevice` treats it as a failed step, not a lost link. */
export const CAMERA_NOT_ANSWERING = 'SKIPPED: the camera is not answering'

/**
 * A BLE session for the camera's side of ending a deployment, with a cap on how
 * long it can take (#293).
 *
 * Ending a deployment reads the op table, clears the deployment id, the GPS and
 * the capture intervals, then sends `dis`. None of it is required: the camera
 * runs on its own and the record is ended in the database regardless. But while
 * monitoring the camera sits in DPD and sometimes does not answer the wake, and
 * each step then waited out its own timeout and retries in turn: about 40 s on
 * the bench on 5 September 2026, under a "Disconnecting" spinner with no sign
 * of what was happening. So:
 *
 * - **The first command is a probe:** one attempt, no retry.
 * - **The first timeout gives up on the camera.** Every later step for the
 *   Himax fails at once with `CAMERA_NOT_ANSWERING`, sending nothing.
 * - **All the Himax steps together get `END_DEPLOYMENT_BUDGET_MS`.** A command
 *   still queued or waiting for its reply when it runs out is cancelled, and
 *   the camera given up on.
 * - **Commands the nRF answers itself are never skipped or cut short.** Only
 *   `AI ` commands go on to the Himax, the part that sleeps. The nRF is awake
 *   whenever the link is up, and its `dis` is what ends the link cleanly.
 *
 * `onGiveUp` fires once, when the camera is given up on, so the caller can tell
 * the operator straight away rather than at the end.
 */
export function createEndDeploymentSession(
    peripheral: ExtendedPeripheral,
    options?: { budgetMs?: number; onGiveUp?: () => void },
) {
    const session = createBleSession(peripheral)
    const budgetMs = options?.budgetMs ?? END_DEPLOYMENT_BUDGET_MS
    let deadline: number | null = null
    let probed = false
    let gaveUp = false

    const giveUp = (why: string) => {
        if (gaveUp) return
        gaveUp = true
        logWarn(`[EndDeployment] ${why}; skipping the camera's remaining steps`)
        options?.onGiveUp?.()
    }

    const execute = async <T>(
        commandConstructor: () => CommandContext<T>,
        executeOptions?: { maxRetries?: number },
    ): Promise<T> => {
        if (!commandConstructor().build().startsWith('AI ')) {
            return session.execute(commandConstructor, executeOptions)
        }
        if (gaveUp) throw new Error(CAMERA_NOT_ANSWERING)

        if (deadline === null) deadline = Date.now() + budgetMs
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
            giveUp(`No answer within the ${budgetMs / 1000} s budget`)
            throw new Error(CAMERA_NOT_ANSWERING)
        }

        const maxRetries = executeOptions?.maxRetries ?? (probed ? undefined : 0)
        probed = true
        const budget = new AbortController()
        const timer = setTimeout(() => budget.abort(), remaining)
        try {
            return await session.execute(commandConstructor, { maxRetries, signal: budget.signal })
        } catch (err) {
            if (budget.signal.aborted) {
                giveUp(`No answer within the ${budgetMs / 1000} s budget`)
            } else if (/TIMEOUT/i.test((err as Error)?.message ?? '')) {
                giveUp('The camera did not answer')
            }
            throw err
        } finally {
            clearTimeout(timer)
        }
    }

    return {
        ...session,
        execute,
        /** True once the camera has been given up on and its remaining steps skipped. */
        cameraNotAnswering: () => gaveUp,
    }
}

export type EndDeploymentSession = ReturnType<typeof createEndDeploymentSession>
