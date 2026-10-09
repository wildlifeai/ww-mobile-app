import { log } from '../utils/logger'
import { logCloudFailure } from '../utils/networkErrors'

/**
 * How long the connection has to stay up before the queued work goes. Field
 * Wi-Fi and mobile data flap: on the bench the Wi-Fi dropped and came back
 * within a minute. A few seconds lets a flap settle into one sync instead of
 * starting one per bounce, and is short next to the upload it precedes.
 */
export const RECONNECT_SETTLE_MS = 3000

/**
 * Uploads the work queued offline when the connection returns.
 *
 * Nothing did before this: OfflineService, which had a listener for it, was never
 * initialised (and was deleted as dead code in #393), so a deployment started and stopped offline sat in the outbox
 * until the next sign-in, pull to refresh or organisation switch (bench,
 * 29 September 2026, 4 operations pending after Wi-Fi came back).
 *
 * The rules:
 * - **One sync per reconnect**, however much the network flaps: the trigger
 *   waits `settleMs` of connection, and a new reconnect restarts the wait.
 * - **Never two at once.** A reconnect during a sync does not start another;
 *   `SupabaseSyncService.sync()` guards itself as well.
 * - **Signed in only**, and **only on a session that is valid.** A token that
 *   expired offline is refreshed first (#310). If that refresh cannot get
 *   through yet, the sync waits for the next session change, which is the
 *   refresh succeeding, rather than going out with a token the server would
 *   refuse. The sync then checks the user with the server before it uploads.
 */
export function createReconnectSync(deps: {
    /** Whether a user is signed in on this device. */
    isSignedIn: () => boolean
    /** Refresh the session if it needs it; true once it is valid. */
    ensureValidSession: () => Promise<boolean>
    /** Upload the outbox and pull, as `SupabaseSyncService.sync()`. */
    sync: () => Promise<void>
    /** Pull the reference tables skipped while offline. */
    pullReferenceData?: () => Promise<void>
    settleMs?: number
}) {
    const settleMs = deps.settleMs ?? RECONNECT_SETTLE_MS
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let waitingForSession = false

    const clear = () => {
        if (timer) clearTimeout(timer)
        timer = null
    }

    const run = async () => {
        timer = null
        if (running || !deps.isSignedIn()) return
        running = true
        try {
            if (!(await deps.ensureValidSession())) {
                waitingForSession = true
                log('🔌 Back online, but the session is not refreshed yet; the sync waits for it')
                return
            }
            waitingForSession = false
            log('🔌 Back online: uploading work queued offline')
            await deps.sync()
            deps.pullReferenceData?.().catch(e => logCloudFailure('❌ Reference data sync after reconnect failed:', e))
        } catch (e) {
            logCloudFailure('❌ Sync after reconnect failed:', e)
        } finally {
            running = false
        }
    }

    const schedule = () => {
        clear()
        timer = setTimeout(run, settleMs)
    }

    return {
        /** The connection came back. */
        onReconnect: schedule,
        /** The connection went. A sync not yet started is dropped; the next reconnect brings it back. */
        onOffline: clear,
        /** The session changed, a token refresh above all: go now if a sync was waiting for it. */
        onSessionChanged: () => {
            if (waitingForSession) schedule()
        },
        dispose: clear,
    }
}
