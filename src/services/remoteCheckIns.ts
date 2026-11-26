import { getSupabaseClient } from './supabase'
import { toHealthState, type HealthState } from '../utils/cameraHealth'

/**
 * A deployed camera's newest LoRaWAN check-in, read live from ww-backend's view
 * `deployment_latest_lorawan` (#518): one row per deployment with the time of its newest message
 * of any kind, the latest battery and SD free space, and the health state and reasons the
 * backend works out (ww-backend#358, #381). Never synced into the phone's database: offline there
 * is no check-in to show. The view runs as the caller, so only deployments the account may read
 * come back.
 */
export interface CheckIn {
    /** The newest message of any kind, ISO. */
    lastSeen: string
    batteryMv: number | null
    /** Percent of the battery byte's scale, for older firmware with no `batteryMv`. */
    batteryPct: number | null
    /** Null when the camera reports it unknown. */
    sdFreePct: number | null
    health: HealthState | null
    /** `health_reasons` codes, worst first. */
    healthReasons: string[]
}

const COLUMNS = 'deployment_id, received_at, battery_level, battery_mv, sd_free_pct, health_state, health_reasons'

/** Deployment ids per request, so an `in.(...)` list stays well inside the URL limit. */
const ID_CHUNK = 100

/** The newest check-in of each deployment that has one, by deployment id. */
export async function fetchLatestCheckIns(deploymentIds: string[]): Promise<Record<string, CheckIn>> {
    const out: Record<string, CheckIn> = {}
    if (deploymentIds.length === 0) return out
    const chunks: string[][] = []
    for (let i = 0; i < deploymentIds.length; i += ID_CHUNK) chunks.push(deploymentIds.slice(i, i + ID_CHUNK))
    const supabase = getSupabaseClient()
    const reads = await Promise.all(chunks.map(ids => supabase
        .from('deployment_latest_lorawan')
        .select(COLUMNS)
        .in('deployment_id', ids)))
    for (const { data, error } of reads) {
        if (error) throw new Error(error.message)
        for (const m of data ?? []) {
            if (!m.deployment_id || !m.received_at) continue
            out[m.deployment_id] = {
                lastSeen: m.received_at,
                batteryMv: m.battery_mv,
                batteryPct: m.battery_level,
                sdFreePct: m.sd_free_pct,
                health: toHealthState(m.health_state),
                healthReasons: m.health_reasons ?? [],
            }
        }
    }
    return out
}
