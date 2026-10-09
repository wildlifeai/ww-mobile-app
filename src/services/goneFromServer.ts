/**
 * A deployment the server no longer has for this account, deleted there or
 * moved out of this account's projects, that the phone keeps because it holds
 * work not yet uploaded (#411, SupabaseSyncService.applyServerDeletions). It is
 * marked in the row's `_custom_sync_status`, and nothing more is uploaded for
 * it: a change made to it later is orphaned at the push, its photos are not
 * uploaded, and the project reconcile does not queue its work again. The
 * deployment pull clears the mark if the server sends the deployment again.
 */
export const GONE_FROM_SERVER = 'gone'

export const isGoneFromServer = (deployment: { customSyncStatus?: string | null }): boolean =>
    deployment.customSyncStatus === GONE_FROM_SERVER
