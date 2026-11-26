import { useEffect, useState } from 'react'
import { fetchLatestCheckIns, type CheckIn } from '../services/remoteCheckIns'
import { isKnownWithoutInternet, watchConnectivity } from '../services/connectivityWatch'
import { cameraState, type CameraState } from '../utils/cameraHealth'
import { logWarn } from '../utils/logger'
import type Deployment from '../database/models/Deployment'

export interface RemoteCheckIns {
    /** By deployment id; a deployment with no message yet has no entry. */
    checkIns: Record<string, CheckIn>
    /** When they were read, ms. States and ages are worked out as of then. */
    readAt: number
}

/**
 * The newest LoRaWAN check-in of each deployment, read live when the phone is online (#518).
 * Null offline, before the first read, and when the read fails: the card and the map rings
 * then show nothing, rather than an old reading or an error. Read again when the deployments
 * change or the connection comes back, and dropped when it goes.
 */
export function useRemoteCheckIns(deploymentIds: string[]): RemoteCheckIns | null {
    const key = [...deploymentIds].sort().join(',')
    const [read, setRead] = useState<(RemoteCheckIns & { key: string }) | null>(null)
    // Counts the reconnects, so each one reads again
    const [connection, setConnection] = useState(0)

    useEffect(() => watchConnectivity({
        onOffline: () => setRead(null),
        onReconnect: () => setConnection(n => n + 1),
    }), [])

    useEffect(() => {
        if (!key) return
        let live = true
        isKnownWithoutInternet()
            .then(offline => (offline ? null : fetchLatestCheckIns(key.split(','))))
            .then(checkIns => { if (live) setRead(checkIns ? { key, checkIns, readAt: Date.now() } : null) })
            .catch(err => {
                logWarn('[RemoteCheckIns] Could not read the latest check-ins:', err)
                if (live) setRead(null)
            })
        return () => { live = false }
    }, [key, connection])

    // The read itself, so a caller's memo holds until the next read
    return read?.key === key ? read : null
}

/** A deployment's camera state from its check-in, by the website's rules (`cameraHealth.ts`). */
export function remoteState(deployment: Deployment, checkIn: CheckIn | undefined, now: number): CameraState {
    return cameraState({
        lastSeen: checkIn?.lastSeen ?? null,
        deploymentStart: deployment.deploymentStart ? new Date(deployment.deploymentStart).toISOString() : null,
        deploymentEnd: deployment.deploymentEnd ? new Date(deployment.deploymentEnd).toISOString() : null,
        pingMinutes: deployment.lorawanPingMinutes ?? null,
        health: checkIn?.health ?? null,
    }, now)
}
