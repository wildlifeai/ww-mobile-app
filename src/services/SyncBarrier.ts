/**
 * SyncBarrier — Event-driven sync readiness barrier
 *
 * Used by the scanner to avoid "no projects" before DB hydration.
 * Resolves via Redux store subscription (not polling) when the sync
 * slice transitions to hasCompletedInitialSync: true.
 *
 * @see syncSlice.ts — hasCompletedInitialSync
 * @see useDeviceDiscovery.ts — project readiness check
 */

import store from '../redux'
import { log, logWarn } from '../utils/logger'

const INITIAL_SYNC_TIMEOUT_MS = 15000

/**
 * Wait for the initial data sync to complete.
 *
 * Resolution rules:
 * - If sync already completed → resolves immediately
 * - If sync not in progress (offline, no auth) → resolves immediately
 *   (let the caller handle empty-DB-offline case)
 * - If sync is in progress → subscribes to Redux store, resolves when
 *   hasCompletedInitialSync becomes true OR isGlobalSyncing becomes false
 * - Timeout → resolves (not rejects) after timeoutMs — caller handles empty state
 */
export function waitForInitialSync(timeoutMs = INITIAL_SYNC_TIMEOUT_MS): Promise<void> {
    const state = store.getState()

    // Already synced — resolve immediately
    if (state.sync.hasCompletedInitialSync) {
        return Promise.resolve()
    }

    // Not syncing at all (offline, no auth) — resolve immediately
    // Let the caller handle empty-DB-offline case
    if (!state.sync.isGlobalSyncing) {
        return Promise.resolve()
    }

    // Sync is in progress — wait for it via store subscription
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            unsubscribe()
            logWarn('[SyncBarrier] Initial sync timed out after', timeoutMs, 'ms')
            resolve()  // resolve, not reject — let caller handle empty state
        }, timeoutMs)

        const unsubscribe = store.subscribe(() => {
            const current = store.getState()
            if (current.sync.hasCompletedInitialSync || !current.sync.isGlobalSyncing) {
                clearTimeout(timeout)
                unsubscribe()
                log('[SyncBarrier] Initial sync completed — proceeding')
                resolve()
            }
        })
    })
}
