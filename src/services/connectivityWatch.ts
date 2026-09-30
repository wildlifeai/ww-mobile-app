import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

/**
 * Follows the connection for the cloud work that needs one.
 *
 * Offline is the field's normal state, and the "Offline Mode" banner already
 * says so. What should not happen then is the app trying the cloud anyway and
 * failing noisily, so:
 *
 * - **Going offline** calls `onOffline`, where the app stops auth-js's token
 *   auto-refresh. Each tick without a network runs a refresh with its retries,
 *   about 26 s and a dozen console errors, for a token nothing can use (#310).
 * - **Coming back** calls `onReconnect`, where the app restarts the
 *   auto-refresh (its first tick renews an expired token straight away) and
 *   resumes the sync and the reference pull it skipped while offline.
 *
 * `isConnected: null` (not known yet) counts as online, as it does for the
 * banner, so nothing is held back on a guess. The first state reported only
 * sets the baseline, apart from an offline start, which calls `onOffline`.
 */
export function watchConnectivity(handlers: {
    onOffline?: () => void
    onReconnect?: () => void
}): () => void {
    let online: boolean | null = null
    return NetInfo.addEventListener((state: NetInfoState) => {
        const now = state.isConnected !== false
        if (now === online) return
        const wasOffline = online === false
        online = now
        if (!now) handlers.onOffline?.()
        else if (wasOffline) handlers.onReconnect?.()
    })
}

/** Whether NetInfo says there is no connection at all. Unknown counts as connected. */
export async function isKnownOffline(): Promise<boolean> {
    const state = await NetInfo.fetch()
    return state.isConnected === false
}
