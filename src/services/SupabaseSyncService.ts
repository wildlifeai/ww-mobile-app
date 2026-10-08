import { Q } from '@nozbe/watermelondb'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'
import SyncOutbox from '../database/models/SyncOutbox'
import SyncStateService, { PULL_WATERMARK_KEYS, SYNC_STATE_KEYS } from './SyncStateService'
import { Database } from '../types/database.types'
import UserRole from '../database/models/UserRole'
import Device from '../database/models/Device'
import Project from '../database/models/Project'
import NetInfo from '@react-native-community/netinfo'
import type { RootState } from '../redux'
import { generateUUID } from '../utils/uuid'
import type Deployment from '../database/models/Deployment'
import { log, logError, logWarn } from '../utils/logger'
import { logCloudFailure } from '../utils/networkErrors'
import { DEFAULT_FLASH_LED, DEFAULT_FLASH_MODE } from '../utils/projectFlash'
import { DEFAULT_PHOTO_INTERVAL_MS, DEFAULT_PHOTOS_PER_TRIGGER } from '../utils/projectBurst'
import { DEFAULT_DETECTION_THRESHOLD_PCT } from '../utils/projectDetectionThreshold'


import { setGlobalSyncing, markInitialSyncComplete } from '../redux/slices/syncSlice'

/** The tables a deployment points at */
type ParentTable = 'projects' | 'devices'

/** Why some of a table's changes did not reach the server */
interface PushProblem {
    count: number
    reason: string
}

/** What one push_changes call, or one table's calls, did */
interface PushOutcome {
    saved: number
    /** Records with a change the server did not take */
    failedRecordIds: Set<string>
    /** The server answered with an error code, so retrying row by row can isolate it */
    refused: boolean
    problems: PushProblem[]
}

/**
 * An outbox operation recorded by a different account than the one syncing
 * (#267). Operations with no recorded owner are pushed as before. A device
 * CREATE is never held: it registers the camera rather than anyone's work,
 * and this account's deployment of that camera may be waiting on it.
 */
const isHeldForAnotherAccount = (op: SyncOutbox, currentUserId: string): boolean => {
    const owner = op.userId
    if (!owner || owner === 'system' || owner === currentUserId) return false
    return !(op.tableName === 'devices' && op.operationType.toUpperCase() === 'CREATE')
}

const mergeOutcomes = (outcomes: PushOutcome[]): PushOutcome => {
    const problems = new Map<string, number>()
    for (const outcome of outcomes) {
        for (const problem of outcome.problems) {
            problems.set(problem.reason, (problems.get(problem.reason) ?? 0) + problem.count)
        }
    }
    return {
        saved: outcomes.reduce((sum, outcome) => sum + outcome.saved, 0),
        failedRecordIds: new Set(outcomes.flatMap(outcome => Array.from(outcome.failedRecordIds))),
        refused: outcomes.some(outcome => outcome.refused),
        problems: Array.from(problems, ([reason, count]) => ({ count, reason })),
    }
}

/** One table's line in the push report, e.g. "devices: 1 refused by the server (42501 ...)" */
const describeOutcome = (tableName: string, outcome: PushOutcome): string => {
    const parts = outcome.saved > 0 ? [`${outcome.saved} saved`] : []
    for (const problem of outcome.problems) {
        parts.push(`${problem.count} ${problem.reason}`)
    }
    return `${tableName}: ${parts.join(', ')}`
}

class SupabaseSyncService {
    private realtimeChannel: RealtimeChannel | null = null
    private isSyncing = false
    /** A sync was asked for while one was running, see sync() */
    private syncAgain = false
    private syncDebounceTimer: NodeJS.Timeout | null = null
    private readonly SYNC_DEBOUNCE_MS = 2000 // 2 seconds
    private store: any = null

    public setStore(store: any) {
        this.store = store
    }

    /**
     * Reset sync state on app startup
     * Clears any stuck "in progress" flags from previous crashes
     */
    async resetSyncState() {
        log('🔄 Resetting sync state...')

        // INTEGRITY CHECK: Detect DB Reset (e.g. after migration failure)
        // If the DB is missing the timestamp record but AsyncStorage has it, we interpret this as a reset/inconsistency.
        try {
            const lastPullTs = await SyncStateService.getLastPullTimestamp()
            if (lastPullTs > 0) {
                const dbRecords = await database.get('sync_state')
                    .query(Q.where('key', SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP))
                    .fetch()

                if (dbRecords.length === 0) {
                    logWarn('⚠️ [SupabaseSyncService] Detected zombie LAST_PULL_TIMESTAMP in cache (missing in DB). Clearing AsyncStorage sync cache.')
                    await SyncStateService.clearAllState()
                }
            }
        } catch (e) {
            logError('⚠️ [SupabaseSyncService] Failed to check integrity:', e)
        }

        this.isSyncing = false
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
            this.syncDebounceTimer = null
        }

        await database.write(async () => {
            await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'false')
        })
        log('✅ Sync state reset complete')

        // A run killed mid-sync leaves the flag behind, and the sign-in sync
        // can read it before this clears it
        this.syncAgainIfAsked()
    }

    /**
     * Debounced sync - prevents sync thrashing from rapid triggers
     * Waits 2 seconds of inactivity before syncing
     */
    debouncedSync() {
        // Clear existing timer
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
        }

        // Set new timer
        this.syncDebounceTimer = setTimeout(() => {
            log('⏰ Debounce timer expired, triggering sync...')
            // sync() has logged the failure already; an unhandled rejection
            // would only repeat it as a LogBox warning
            this.sync().catch(() => {})
        }, this.SYNC_DEBOUNCE_MS)

        // log(`⏳ Sync debounced (will trigger in ${this.SYNC_DEBOUNCE_MS}ms)`)
    }

    /**
     * Start a sync and do not wait for it, for a change the website should
     * see while the app is still open, such as a deployment started or ended
     * on the phone. Never throws: sync() logs its own failures. Offline it
     * does nothing, and the reconnect sync uploads the change later.
     */
    requestSync() {
        this.sync().catch(() => {})
    }

    /** Run the sync asked for while the last one ran */
    private syncAgainIfAsked() {
        if (!this.syncAgain) return
        this.syncAgain = false
        log('🔁 A sync was asked for while the last one ran, syncing again')
        this.requestSync()
    }

    /**
     * Immediate sync - bypasses debouncing
     */
    async sync() {
        // Check if sync already in progress (via SyncStateService)
        const inProgress = await SyncStateService.isSyncInProgress()
        if (inProgress || this.isSyncing) {
            // The running sync may have read the outbox before the caller's
            // change was queued, so it syncs once more when it ends: one more,
            // however many ask meanwhile
            this.syncAgain = true
            return
        }

        // Check network state - don't sync if offline
        // Try Redux first (maintained by OfflineService), but fallback to NetInfo if offline
        // This handles the race condition where Redux hasn't initialized yet
        let isOnline = false
        try {
            // Use injected store if available, otherwise check NetInfo directly
            if (this.store) {
                const state: RootState = this.store.getState()
                isOnline = state.network.isOnline

                // If Redux says offline, double-check with NetInfo
                if (!isOnline) {
                    const netState = await NetInfo.fetch()
                    if (netState.isConnected === true) {
                        // log(`🌐 Network check: Redux says OFFLINE but NetInfo says ONLINE - using NetInfo`)
                        isOnline = true
                    } else {
                        // log(`🌐 Network check (Redux): OFFLINE`)
                    }
                } else {
                    // log(`🌐 Network check (Redux): ONLINE`)
                }
            } else {
                // Fallback if store not yet injected
                const netState = await NetInfo.fetch()
                isOnline = netState.isConnected === true
                log(`🌐 Network check (No Store): ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
            }
        } catch (e) {
            logError('⚠️ Error checking network state:', e)
            const netState = await NetInfo.fetch()
            isOnline = netState.isConnected === true
        }

        if (!isOnline) {
            // log('⏸️ Device is offline - skipping sync')
            return
        }

        const client = getSupabaseClient()

        // Robustness: Wait for auth session to hydrate if needed (up to 3 retries)
        let user = null
        let attempts = 0
        const MAX_ATTEMPTS = 3
        const RETRY_DELAY_MS = 1000

        while (attempts < MAX_ATTEMPTS) {
            const { data } = await client.auth.getUser()
            user = data.user
            if (user) break

            attempts++
            if (attempts < MAX_ATTEMPTS) {
                log(`👤 Auth user check attempt ${attempts} failed, retrying in ${RETRY_DELAY_MS}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
            }
        }

        if (!user) {
            log('👤 No authenticated user found after retries - skipping sync')
            return
        }

        this.isSyncing = true
        
        // Dispatch global sync start
        if (this.store) {
            try {
                this.store.dispatch(setGlobalSyncing(true))
            } catch (e) {
                logWarn('⚠️ [SupabaseSyncService] Failed to dispatch sync start:', e)
            }
        }

        await database.write(async () => {
            await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'true')
        })

        try {
            await this.resetWatermarksOnUserChange(user.id)

            // STEP 1: UPLOAD OUTBOX OPERATIONS
            // ================================================================
            // A push that did not complete no longer skips the pull (#287): one
            // refused change used to stop this phone seeing anything new from
            // the cloud as well. The push error is thrown once the pull is done.
            let pushError: unknown = null
            try {
                await this.uploadOutbox(user.id)
            } catch (error) {
                pushError = error
            }

            // ================================================================
            // STEP 2: PULL REMOTE CHANGES
            // ================================================================
            await this.pullRemoteChanges()
            await this.syncUserRoles(user.id)
            if (await this.syncProjects()) {
                await this.reconcileProjects(user.id)
            } else {
                log('⏭️ Project pull did not complete, not reconciling projects')
            }
            await this.syncDevices()
            await this.syncDeployments()

            // Mark initial sync complete once the pull is in, whatever the push
            // did: routing decisions in the scanner only need the pulled data
            if (this.store) {
                try {
                    const state = this.store.getState()
                    if (!state.sync.hasCompletedInitialSync) {
                        this.store.dispatch(markInitialSyncComplete())
                        log('🎯 Initial sync complete, routing decisions are now valid')
                    }
                } catch (e) {
                    logWarn('⚠️ [SupabaseSyncService] Failed to dispatch initial sync complete:', e)
                }
            }

            if (pushError) throw pushError

            // ================================================================
            // STEP 3: UPDATE SYNC TIMESTAMPS
            // ================================================================
            // ================================================================

            await database.write(async () => {
                await SyncStateService.set(
                    SYNC_STATE_KEYS.LAST_SYNCED_AT,
                    Date.now().toString()
                )
                await SyncStateService.delete(SYNC_STATE_KEYS.LAST_SYNC_ERROR)

                const currentCount = await SyncStateService.get(SYNC_STATE_KEYS.TOTAL_SYNCS)
                const syncCount = currentCount ? parseInt(currentCount, 10) + 1 : 1
                await SyncStateService.set(SYNC_STATE_KEYS.TOTAL_SYNCS, syncCount.toString())

                // log(`✅ Sync completed successfully in ${syncDuration}ms (total syncs: ${syncCount})`)
            })

            // Retry any deployment photos still waiting to reach storage
            // (lazy import: DeploymentPhotoService depends on this service)
            try {
                const { DeploymentPhotoService } = await import('./DeploymentPhotoService')
                DeploymentPhotoService.uploadAllPending(user.id).catch((e: unknown) =>
                    logWarn('⚠️ [SupabaseSyncService] Pending photo upload failed:', e)
                )
            } catch (e) {
                logWarn('⚠️ [SupabaseSyncService] Could not start photo upload:', e)
            }

            // Put the models and firmware a field visit needs on the phone (#333)
            require('./OfflinePrefetchService').default.request('sync')
        } catch (error) {
            logCloudFailure('❌ Sync failed:', error)

            // Log error to sync state
            const errorMessage = error instanceof Error ? error.message : String(error)
            await database.write(async () => {
                await SyncStateService.set(SYNC_STATE_KEYS.LAST_SYNC_ERROR, errorMessage)
            })

            // Re-throw for debugging
            throw error
        } finally {
            this.isSyncing = false
            await database.write(async () => {
                await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'false')
            })

            // Dispatch global sync end
            if (this.store) {
                try {
                    this.store.dispatch(setGlobalSyncing(false))
                } catch (e) {
                    logWarn('⚠️ [SupabaseSyncService] Failed to dispatch sync end:', e)
                }
            }

            this.syncAgainIfAsked()
        }
    }

    /**
     * Pull watermarks are one set for the phone, not one per account (#267).
     * When a different account syncs here, forget them so its first pull is a
     * full one; otherwise it only asks for rows changed after the previous
     * account's last sync, and never receives its own older roles and projects.
     * Nothing local is deleted: rows already on the phone stay, and another
     * account's unsynced changes stay queued for it (see uploadOutbox).
     */
    private async resetWatermarksOnUserChange(userId: string): Promise<void> {
        const lastUserId = await SyncStateService.get(SYNC_STATE_KEYS.LAST_SYNC_USER_ID)
        if (lastUserId === userId) return

        log(`👤 Sync account changed (${lastUserId ?? 'none recorded'} -> ${userId}), clearing pull watermarks for a full pull`)
        await database.write(async () => {
            for (const key of PULL_WATERMARK_KEYS) {
                await SyncStateService.delete(key)
            }
            await SyncStateService.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, userId)
        })
    }

    /**
     * Upload pending outbox operations to server
     *
     * One push_changes call per table, in foreign-key order. A table the server
     * refuses no longer stops the tables after it (#287): only a deployment whose
     * project or device did not reach the server waits, everything else goes,
     * and the error thrown at the end says per table what was saved, what was
     * refused and why, and what is still waiting.
     */
    private async uploadOutbox(currentUserId: string): Promise<void> {
        // 'syncing' is only left behind by a sync that was cut short: a crash, or
        // the old stop-the-chain break, which stranded every table after the
        // failure for good. Syncs never overlap, so any found here are resumed.
        const queuedOps = await database.get<SyncOutbox>('sync_outbox')
            .query(Q.where('status', Q.oneOf(['pending', 'failed', 'syncing'])))
            .fetch()

        // Another account's unsynced changes stay queued until it signs in on
        // this phone again (#267). Pushing them now would write them under this
        // session with the audit fields rewritten to this user; dropping them
        // would lose field work.
        const heldOps = queuedOps.filter(op => isHeldForAnotherAccount(op, currentUserId))
        if (heldOps.length > 0) {
            const owners = Array.from(new Set(heldOps.map(op => op.userId)))
            logWarn(`⏸️ Holding ${heldOps.length} unsynced change(s) made on this phone by another account (${owners.join(', ')}) until it signs in again`)
        }
        const pendingOps = queuedOps.filter(op => !heldOps.includes(op))

        if (pendingOps.length === 0) {
            // log('✅ Sync complete - no pending operations')
            return
        }

        // Helper to populate changes object
        const populateChanges = (ops: SyncOutbox[], userId?: string) => {
            const result: any = {
                projects: { created: [], updated: [], deleted: [] },
                devices: { created: [], updated: [], deleted: [] },
                deployments: { created: [], updated: [], deleted: [] },
            }

            for (const op of ops) {
                const payload = JSON.parse(op.payload)
                // Add operation_id to payload for server-side idempotency
                payload.operation_id = op.operationId

                const tableName = op.tableName
                const operationType = op.operationType.toLowerCase()

                // ROBUSTNESS: Patch audit fields with current user ID to prevent FK violations
                // This handles cases where local data has stale UUIDs (e.g. after a backend reset)
                if (userId) {
                    const auditFields = ['modified_by', 'created_by', 'setup_by', 'granted_by', 'managed_by']
                    let patched = false

                    // Deployment table doesn't have modified_by in Supabase, so we must exclude it
                    const tablesWithoutModifiedBy = new Set(['deployments'])

                    auditFields.forEach(field => {
                        // Skip modified_by if table doesn't support it
                        if (field === 'modified_by' && tablesWithoutModifiedBy.has(tableName)) {
                            return
                        }

                        // For CREATE: Always ensure we own it
                        // For UPDATE: We are the one modifying it, so we should be the modified_by
                        if (payload[field] && payload[field] !== userId) {
                            // Don't patch created_by on updates if it's already a valid lookin UUID 
                            // (actually in this specific app context, patching is safer to bridge environment gaps)
                            log(`🔧 Patching ${tableName}.${field} from ${payload[field]} to ${userId}`)
                            payload[field] = userId
                            patched = true
                        }
                    })

                    if (patched) {
                        log(`✅ Patched audit fields for ${tableName} ${operationType} (internal ID: ${op.recordId})`)
                    }
                }

                // SECURITY/CRITICAL: Ensure deployments does NOT have modified_by as it's missing on server
                if (tableName === 'deployments') {
                    log(`🔍 Processing deployments payload. Has modified_by: ${'modified_by' in payload}`)
                    if ('modified_by' in payload) {
                        log(`🔧 Removing modified_by from deployments payload (value was: ${payload.modified_by})`)
                        delete payload.modified_by
                        log(`✅ modified_by removed. Still present: ${'modified_by' in payload}`)
                    } else {
                        log(`ℹ️ No modified_by in payload for deployments. Keys: ${Object.keys(payload).join(', ')}`)
                    }
                }

                // Sanitize deleted_at (WatermelonDB uses 0/1970 epoch for null)
                // If it is 1970-01-01 or 0 or undefined, set to null for Supabase
                if (!payload.deleted_at || String(payload.deleted_at).startsWith('1970-01-01') || payload.deleted_at === 0) {
                    payload.deleted_at = null
                }

                // Sanitize deployment_end (WatermelonDB uses 0/1970 epoch for null)
                if (payload.deployment_end && (String(payload.deployment_end).startsWith('1970-01-01') || payload.deployment_end === 0)) {
                    payload.deployment_end = null
                }

                // Ensure timestamps are present
                const now = new Date().toISOString()
                if (!payload.created_at) payload.created_at = now
                if (!payload.updated_at) payload.updated_at = now

                if (result[tableName]) {
                    if (operationType === 'create') {
                        result[tableName].created.push(payload)
                    } else if (operationType === 'update') {
                        result[tableName].updated.push(payload)
                    } else if (operationType === 'delete') {
                        result[tableName].deleted.push(payload.id)
                    }
                }
            }
            return result
        }

        const client = getSupabaseClient()

        // Push some of one table's operations in one push_changes call, and
        // record the outcome on each operation
        const pushBatch = async (tableName: string, tableOps: SyncOutbox[]): Promise<PushOutcome> => {
            // Build changes object just for this table
            // We pass the full structure but only populate the current table
            const changes = populateChanges(tableOps, currentUserId)

            // log(`🔍 DEBUG: Payload for ${tableName}:`, JSON.stringify(changes))

            // CRITICAL FIX: Remove modified_by from deployments at batch level (server-side adds it)
            if (tableName === 'deployments') {
                ['created', 'updated'].forEach(opType => {
                    if (changes.deployments[opType]) {
                        changes.deployments[opType].forEach((record: any) => {
                            if ('modified_by' in record) {
                                log(`🔧 [BATCH-LEVEL] Removing modified_by from deployment ${record.id}`)
                                delete record.modified_by
                            }
                        })
                    }
                })
            }

            // FK GUARD: Validate project model_id references exist in cloud ai_models
            if (tableName === 'projects') {
                const projectRecordsWithModels: { record: any, modelId: string }[] = []
                for (const opType of ['created', 'updated'] as const) {
                    const records = changes.projects?.[opType] as any[] | undefined
                    if (!records) continue
                    for (const record of records) {
                        if (record.model_id) {
                            projectRecordsWithModels.push({ record, modelId: record.model_id })
                        }
                    }
                }

                if (projectRecordsWithModels.length > 0) {
                    const uniqueModelIds = Array.from(new Set(projectRecordsWithModels.map(x => x.modelId)))
                    const { data: existingModels } = await client
                        .from('ai_models')
                        .select('id')
                        .in('id', uniqueModelIds)
                    
                    const existingModelIds = new Set(existingModels?.map((m: any) => m.id) || [])
                    
                    const recordsToUpdateLocal: any[] = []
                    
                    for (const { record, modelId } of projectRecordsWithModels) {
                        if (!existingModelIds.has(modelId)) {
                            log(`🔧 Nulling stale model_id ${modelId} on project ${record.id} (not found in cloud)`)
                            record.model_id = null
                            recordsToUpdateLocal.push(record)
                        }
                    }

                    if (recordsToUpdateLocal.length > 0) {
                        try {
                            const projectsCollection = database.get<Project>('projects')
                            const updates: any[] = []
                            for (const record of recordsToUpdateLocal) {
                                try {
                                    const localProject = await projectsCollection.find(record.id)
                                    updates.push(localProject.prepareUpdate(p => { p.modelId = null }))
                                } catch (e) { /* local record may not exist */ }
                            }
                            if (updates.length > 0) {
                                await database.write(async () => {
                                    await database.batch(...updates)
                                })
                            }
                        } catch (e) {
                            logWarn(`Failed to batch update local project model_ids: ${e}`)
                        }
                    }
                }
            }

            // Mark operations as syncing
            await database.write(async () => {
                for (const op of tableOps) {
                    await op.update(o => {
                        o.status = 'syncing'
                    })
                }
            })

            const recordIds = new Set(tableOps.map(op => op.recordId))

            try {
                const { data, error } = await (client as any).rpc('push_changes', { changes })

                // IMPORTANT DEBUG: Log processed count to detect silent failures
                // log(`✅ Server processed ${data?.processed ?? '?'} operations for ${tableName}`)

                if (error) {
                    logCloudFailure(`❌ Push failed for ${tableName}:`, error)

                    // Mark these specific ops as failed
                    await database.write(async () => {
                        for (const op of tableOps) {
                            await op.update(o => {
                                o.status = 'failed'
                                o.errorMessage = error.message
                                o.retryCount = op.retryCount + 1
                            })
                        }
                    })

                    // SPECIAL HANDLING: Self-healing for Foreign Key errors (23503)
                    if (error.code === '23503') {
                        log('🚑 Attempting self-healing for Foreign Key violation...')
                        
                        // Self-heal deployments that fail because a device hasn't been pushed yet
                        if (tableName === 'deployments') {
                            log('🚑 Self-healing for missing device dependency...')
                            const devicesCollection = database.get<Device>('devices')
                            const missingDeviceIds = new Set<string>()

                            for (const op of tableOps) {
                                try {
                                    const payload = JSON.parse(op.payload)
                                    if (payload.device_id) missingDeviceIds.add(payload.device_id)
                                } catch (e) {}
                            }

                            for (const deviceId of Array.from(missingDeviceIds)) {
                                try {
                                    const localDevice = await devicesCollection.find(deviceId)
                                    if (localDevice) {
                                        const existingOps = await database.get<SyncOutbox>('sync_outbox').query(
                                            Q.where('table_name', 'devices'),
                                            Q.where('record_id', deviceId),
                                            Q.where('operation_type', 'CREATE'),
                                            Q.where('status', Q.oneOf(['pending', 'failed']))
                                        ).fetch()

                                        if (existingOps.length === 0) {
                                            log(`🚑 Self-healing: Queueing CREATE for missing device ${deviceId}`)
                                            await database.write(async () => {
                                                const devicesOutboxCollection = database.get<SyncOutbox>('sync_outbox')
                                                await devicesOutboxCollection.create(op => {
                                                    op.operationId = generateUUID()
                                                    op.operationType = 'CREATE'
                                                    op.tableName = 'devices'
                                                    op.recordId = localDevice.id
                                                    op.payload = JSON.stringify({
                                                        id: localDevice.id,
                                                        bluetooth_id: localDevice.bluetoothId,
                                                        name: localDevice.name,
                                                        organisation_id: localDevice.organisationId || null,
                                                        device_eui: localDevice.deviceEui || null,
                                                        modified_by: currentUserId
                                                    })
                                                    op.version = 0
                                                    op.lamportClock = Date.now()
                                                    op.retryCount = 0
                                                    op.status = 'pending'
                                                })
                                            })
                                        }
                                    }
                                } catch (e) {
                                    log(`⚠️ Cannot heal device ${deviceId} - not found locally`)
                                }
                            }
                        }
                    }

                    // An error with a code is the server refusing the write (RLS,
                    // a constraint); one without is the request not getting there
                    return {
                        saved: 0,
                        failedRecordIds: recordIds,
                        refused: Boolean(error.code),
                        problems: [{
                            count: tableOps.length,
                            reason: error.code
                                ? `refused by the server (${error.code} ${error.message})`
                                : `not sent (${error.message})`,
                        }],
                    }
                }

                log(`✅ Server processed ${data?.processed} operations for ${tableName}`)

                // push_changes lists every row it did not write as {id, reason:
                // 'not_applied'}. For a CREATE that is a row the server already
                // has (ON CONFLICT DO NOTHING), so it counts as saved. For an
                // UPDATE or DELETE the change did not land: the row is missing,
                // or row-level security would not let this account change it.
                // Marking those synced lost them silently, so they stay queued.
                const notAppliedIds = new Set<string>(
                    (Array.isArray(data?.conflicts) ? data.conflicts : []).map((c: any) => String(c?.id))
                )
                const notAppliedOps = tableOps.filter(op =>
                    notAppliedIds.has(op.recordId) && op.operationType.toUpperCase() !== 'CREATE'
                )
                if (notAppliedOps.length > 0) {
                    logWarn(`⚠️ Server did not apply ${notAppliedOps.length} ${tableName} change(s):`, data.conflicts)
                }

                await database.write(async () => {
                    for (const op of tableOps) {
                        if (notAppliedOps.includes(op)) {
                            await op.update(o => {
                                o.status = 'failed'
                                o.errorMessage = 'not_applied: the row is missing on the server, or this account may not change it'
                                o.retryCount = op.retryCount + 1
                            })
                        } else {
                            await op.update(o => {
                                o.status = 'synced'
                            })
                        }
                    }
                })

                return {
                    saved: tableOps.length - notAppliedOps.length,
                    failedRecordIds: new Set(notAppliedOps.map(op => op.recordId)),
                    refused: false,
                    problems: notAppliedOps.length > 0
                        ? [{ count: notAppliedOps.length, reason: 'not applied by the server (row missing, or this account may not change it)' }]
                        : [],
                }
            } catch (err) {
                logCloudFailure(`❌ Exception during push for ${tableName}:`, err)
                const message = err instanceof Error ? err.message : String(err)

                // Left 'syncing', these were never picked up again
                await database.write(async () => {
                    for (const op of tableOps) {
                        await op.update(o => {
                            o.status = 'failed'
                            o.errorMessage = message
                            o.retryCount = op.retryCount + 1
                        })
                    }
                })

                return {
                    saved: 0,
                    failedRecordIds: recordIds,
                    refused: false,
                    problems: [{ count: tableOps.length, reason: `not sent (${message})` }],
                }
            }
        }

        // Define upload order: Projects -> Devices -> Deployments
        // This ensures Foreign Keys are satisfied (e.g. Deployment needs Device & Project)
        const uploadOrder = ['projects', 'devices', 'deployments']

        // Devices with a change in this sync that did not reach the server
        const devicesNotOnServer = new Set(heldOps.filter(op => op.tableName === 'devices').map(op => op.recordId))
        const report: string[] = []
        let anyFailures = false

        for (const tableName of uploadOrder) {
            let tableOps = pendingOps.filter(op => op.tableName === tableName)
            if (tableOps.length === 0) continue

            // DEPENDENCY SAFETY: a deployment must not reach the server before its
            // project and device. Only the deployments whose parent is missing wait.
            const waitingProblems: PushProblem[] = []
            if (tableName === 'deployments') {
                const waiting = await this.deploymentsWaitingOnParents(tableOps, devicesNotOnServer)
                if (waiting.length > 0) {
                    logWarn(`⏳ Holding back ${waiting.length} deployments op(s): their project or device has not reached the server`)
                    waitingProblems.push({ count: waiting.length, reason: 'waiting for their project or device to reach the server' })
                    await database.write(async () => {
                        for (const op of waiting) {
                            await op.update(o => {
                                o.status = 'pending'
                                o.errorMessage = 'Waiting for its project or device to reach the server'
                            })
                        }
                    })
                    tableOps = tableOps.filter(op => !waiting.includes(op))
                }
            }

            let outcome: PushOutcome = { saved: 0, failedRecordIds: new Set(), refused: false, problems: [] }
            if (tableOps.length > 0) {
                log(`📤 Uploading batch for table: ${tableName} (${tableOps.length} ops)`)
                outcome = await pushBatch(tableName, tableOps)

                // push_changes applies a call all or nothing, so one refused row
                // fails every row sent with it. Retry record by record so the
                // refusal stays with the row that caused it.
                const recordIds = Array.from(new Set(tableOps.map(op => op.recordId)))
                if (outcome.refused && recordIds.length > 1) {
                    log(`🔁 ${tableName} batch refused, retrying its ${recordIds.length} records one at a time`)
                    const perRecord: PushOutcome[] = []
                    for (const recordId of recordIds) {
                        perRecord.push(await pushBatch(tableName, tableOps.filter(op => op.recordId === recordId)))
                    }
                    outcome = mergeOutcomes(perRecord)
                }
            }
            outcome.problems.push(...waitingProblems)

            if (tableName === 'devices') {
                outcome.failedRecordIds.forEach(id => devicesNotOnServer.add(id))
            }
            if (outcome.problems.length > 0) anyFailures = true
            report.push(describeOutcome(tableName, outcome))
        }

        if (anyFailures) {
            throw new Error(`Push incomplete. ${report.join('; ')}`)
        }
        log(`✅ Push complete. ${report.join('; ')}`)
    }

    /**
     * The deployment operations that must wait for a parent the server does not
     * have. A deployment whose parent is already there goes ahead, whatever
     * happened to other rows (#287).
     *
     * Every deployment's project is checked, not only one that failed in this
     * sync: a project can also disappear from the server on its own, deleted on
     * the website or by a database reset, and a deployment pushed into it is
     * refused with 42501 on every sync (#330). Such a deployment waits here, and
     * the project reconcile after the pull marks it orphaned. A device is only
     * checked when its own change failed in this sync; a device the server has
     * never seen is healed by the 23503 path below.
     */
    private async deploymentsWaitingOnParents(
        deploymentOps: SyncOutbox[],
        devicesNotOnServer: Set<string>,
    ): Promise<SyncOutbox[]> {
        const parentsOf = (op: SyncOutbox): { projectId?: string, deviceId?: string } => {
            try {
                const payload = JSON.parse(op.payload)
                return { projectId: payload.project_id || undefined, deviceId: payload.device_id || undefined }
            } catch (e) {
                return {}
            }
        }

        const suspects: Record<ParentTable, Set<string>> = { projects: new Set(), devices: new Set() }
        for (const op of deploymentOps) {
            const { projectId, deviceId } = parentsOf(op)
            if (projectId) suspects.projects.add(projectId)
            if (deviceId && devicesNotOnServer.has(deviceId)) suspects.devices.add(deviceId)
        }
        if (suspects.projects.size === 0 && suspects.devices.size === 0) return []

        const onServer: Record<ParentTable, Set<string>> = {
            projects: await this.idsOnServer('projects', suspects.projects),
            devices: await this.idsOnServer('devices', suspects.devices),
        }
        const blockedRecords = new Set<string>()
        for (const op of deploymentOps) {
            const { projectId, deviceId } = parentsOf(op)
            const projectMissing = !!projectId && suspects.projects.has(projectId) && !onServer.projects.has(projectId)
            const deviceMissing = !!deviceId && suspects.devices.has(deviceId) && !onServer.devices.has(deviceId)
            if (projectMissing || deviceMissing) blockedRecords.add(op.recordId)
        }
        // Every operation on a blocked record waits, so they stay in order
        return deploymentOps.filter(op => blockedRecords.has(op.recordId))
    }

    /**
     * Which of these ids the server has and lets this account see. A project
     * soft-deleted on the website counts as gone. A failed check returns none,
     * so the deployments that depend on them wait.
     */
    private async idsOnServer(tableName: ParentTable, ids: Set<string>): Promise<Set<string>> {
        if (ids.size === 0) return new Set()
        try {
            let query = getSupabaseClient()
                .from(tableName)
                .select('id')
                .in('id', Array.from(ids))
            if (tableName === 'projects') query = query.is('deleted_at', null)
            const { data, error } = await query
            if (error) throw error
            return new Set((data || []).map((row: any) => row.id))
        } catch (e) {
            logWarn(`⚠️ Could not check which ${tableName} the server has, holding their deployments:`, e)
            return new Set()
        }
    }

    /**
     * Remove the projects this account can no longer see (#330)
     *
     * The project pull is incremental, so it never hears about a project that
     * stops existing for this account: deleted on the website, wiped by a
     * database reset, or the account taken off it. The phone kept those for
     * good, and every deployment made on one was refused on each sync. So after
     * the project pull, the phone is compared with the full list of project ids
     * the server returns for this account.
     *
     * A project missing there, with no CREATE still queued or in flight, is
     * gone: its row, its synced deployments and every role scoped to it are
     * removed. Nothing not yet uploaded is destroyed. A deployment with an
     * unsynced change or a photo still on the phone keeps its row, and this
     * account's unsynced operations for the project are marked 'orphaned',
     * which is never retried, with the project named in the log and in each
     * operation's error_message (OutboxService.getOrphanedOperations). Another
     * account's held operations are left alone, since that account may still
     * see the project.
     *
     * Only called after a project pull that completed. It does nothing when the
     * id list fails, comes back short of its own count, or would remove every
     * project on the phone, which reads as a bad answer rather than deletions.
     */
    private async reconcileProjects(userId: string): Promise<void> {
        try {
            const { data, error, count } = await getSupabaseClient()
                .from('projects_with_stats')
                .select('id', { count: 'exact' })
                .is('deleted_at', null)
            if (error || !Array.isArray(data)) {
                logWarn('⚠️ Project reconcile skipped, could not list this account\'s projects:', error)
                return
            }
            if (typeof count === 'number' && count !== data.length) {
                logWarn(`⚠️ Project reconcile skipped, the server listed ${data.length} of ${count} projects`)
                return
            }
            const serverIds = new Set<string>(data.map((row: any) => row.id))

            const projects = await database.get<Project>('projects').query().fetch()
            const deployments = await database.get<Deployment>('deployments').query().fetch()
            const roles = await database.get<UserRole>('user_roles')
                .query(Q.where('scope_type', 'project'))
                .fetch()
            const unsyncedOps = await database.get<SyncOutbox>('sync_outbox')
                .query(Q.where('status', Q.oneOf(['pending', 'failed', 'syncing', 'orphaned'])))
                .fetch()

            // A project whose CREATE has not reached the server is new, not gone
            const createsQueued = new Set(unsyncedOps
                .filter(op => op.tableName === 'projects'
                    && op.operationType.toUpperCase() === 'CREATE'
                    && op.status !== 'orphaned')
                .map(op => op.recordId))
            const knownHere = [
                ...projects.map(p => p.id),
                ...deployments.map(d => d.projectId),
                ...roles.map(r => r.scopeId),
            ].filter((id): id is string => !!id)
            const gone = new Set(knownHere.filter(id => !serverIds.has(id) && !createsQueued.has(id)))

            const goneProjects = projects.filter(p => gone.has(p.id))
            if (serverIds.size === 0 || (projects.length > 0 && goneProjects.length === projects.length)) {
                if (gone.size > 0) {
                    logWarn(`⚠️ Project reconcile skipped: it would remove every project on this phone (${projects.length}), which reads as a bad answer from the server, not as deletions`)
                }
                return
            }

            await this.pullAgainIfProjectsMissing(serverIds, projects)

            const deploymentProject = new Map(deployments.map(d => [d.id, d.projectId]))
            const projectOf = (op: SyncOutbox): string | undefined => {
                if (op.tableName === 'projects') return op.recordId
                if (op.tableName !== 'deployments') return undefined
                const local = deploymentProject.get(op.recordId)
                if (local) return local
                try {
                    return JSON.parse(op.payload).project_id || undefined
                } catch (e) {
                    return undefined
                }
            }
            const hasLocalPhotos = (deployment: Deployment): boolean => {
                try {
                    const raw: any = deployment.cameraLocationImagePaths
                    const paths: string[] = typeof raw === 'string' ? JSON.parse(raw) : (raw || [])
                    return paths.some(path => typeof path === 'string' && path.startsWith('file://'))
                } catch (e) {
                    return false
                }
            }

            const operations: any[] = []

            // A project can come back: a role granted again, or an earlier answer
            // that was short, as during a database reseed. Its orphaned changes
            // go back in the queue.
            const restored = unsyncedOps.filter(op => {
                if (op.status !== 'orphaned') return false
                const projectId = projectOf(op)
                return !!projectId && serverIds.has(projectId)
            })
            for (const op of restored) {
                operations.push(op.prepareUpdate(o => {
                    o.status = 'pending'
                    o.errorMessage = undefined
                }))
            }
            if (restored.length > 0) {
                log(`↩️ ${restored.length} orphaned change(s) belong to a project that is back on the server, queued again`)
            }

            let orphanedTotal = 0
            for (const projectId of Array.from(gone)) {
                const project = goneProjects.find(p => p.id === projectId)
                const label = project ? `"${project.name}" (${projectId})` : projectId

                const opsHere = unsyncedOps.filter(op => projectOf(op) === projectId)
                const toOrphan = opsHere.filter(op => op.status !== 'orphaned' && !isHeldForAnotherAccount(op, userId))
                const unsyncedRecords = new Set(opsHere.map(op => op.recordId))

                const itsDeployments = deployments.filter(d => d.projectId === projectId)
                const keptDeployments = itsDeployments.filter(d => unsyncedRecords.has(d.id) || hasLocalPhotos(d))
                const removedDeployments = itsDeployments.filter(d => !keptDeployments.includes(d))
                const itsRoles = roles.filter(r => r.scopeId === projectId)

                for (const op of toOrphan) {
                    operations.push(op.prepareUpdate(o => {
                        o.status = 'orphaned'
                        o.errorMessage = `orphaned: project ${label} is not on the server for this account`
                    }))
                }
                removedDeployments.forEach(d => operations.push(d.prepareDestroyPermanently()))
                itsRoles.forEach(r => operations.push(r.prepareDestroyPermanently()))
                if (project) operations.push(project.prepareDestroyPermanently())
                orphanedTotal += toOrphan.length

                logWarn(`🧹 Project ${label} is not on the server for this account: removed ${project ? 'it, ' : ''}${removedDeployments.length} synced deployment(s) and ${itsRoles.length} role(s); kept ${keptDeployments.length} deployment(s) with work not yet uploaded, ${toOrphan.length} change(s) marked orphaned and no longer retried`)
            }

            if (operations.length > 0) {
                await database.write(async () => {
                    await database.batch(...operations)
                })
            }
            if (orphanedTotal > 0) {
                logWarn(`📦 ${orphanedTotal} change(s) on this phone belong to a project that is gone, kept as orphaned`)
            }
        } catch (error) {
            logCloudFailure('❌ Project reconcile failed, nothing removed:', error)
        }
    }

    /**
     * The project pull is incremental, so a project the server lists for this
     * account but the phone has never pulled, because it is older than the
     * watermark, would never arrive. That happens when the reconcile removed a
     * project on a partial answer, for example during a database reseed, and it
     * came back. Clear the watermarks so the next sync pulls everything again.
     * A project the phone still holds as deleted is not counted, so a
     * tombstone cannot cause a full pull on every sync.
     */
    private async pullAgainIfProjectsMissing(serverIds: Set<string>, projects: Project[]): Promise<void> {
        const here = new Set(projects.map(p => p.id))
        const missing: string[] = []
        for (const id of Array.from(serverIds)) {
            if (here.has(id)) continue
            try {
                await database.get<Project>('projects').find(id)
            } catch (e) {
                missing.push(id)
            }
        }
        if (missing.length === 0) return

        log(`🔁 ${missing.length} project(s) on the server are not on this phone (${missing.join(', ')}), next sync pulls projects and deployments in full`)
        await database.write(async () => {
            await SyncStateService.delete(SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT)
            await SyncStateService.delete(SYNC_STATE_KEYS.DEPLOYMENTS_LAST_PULLED_AT)
        })
    }

    /**
     * Pull remote changes from server
     */
    private async pullRemoteChanges(): Promise<void> {
        const lastPulledStr = await SyncStateService.get(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)
        const lastPulledAt = lastPulledStr ? parseInt(lastPulledStr, 10) : 0

        // log('🔽 Pulling changes since', lastPulledAt)
        const client = getSupabaseClient()

        const { data, error } = await (client as any).rpc('pull_changes', {
            last_pulled_at: lastPulledAt
        })

        if (error) {
            logCloudFailure('❌ Pull changes failed:', error)
            throw error
        }

        const { changes: rawChanges, conflicts, timestamp } = data as any

        // ================================================================
        // CRITICAL: Filter out records with pending local changes
        // ================================================================
        // log('🔍 Filtering pending local changes from server updates...')

        // Get all pending operations from outbox
        const pendingOps = await database.get<SyncOutbox>('sync_outbox')
            .query(Q.where('status', 'pending'))
            .fetch()

        // Build set of record IDs that have pending changes
        const pendingByTable: Record<string, Set<string>> = {
            projects: new Set(),
            devices: new Set(),
            deployments: new Set(),
        }

        for (const op of pendingOps) {
            if (pendingByTable[op.tableName]) {
                pendingByTable[op.tableName].add(op.recordId)
            }
        }

        log(`📦 Found ${pendingOps.length} pending operations in outbox:`)
        for (const [table, ids] of Object.entries(pendingByTable)) {
            if (ids.size > 0) {
                log(`   - ${table}: ${ids.size} pending`)
            }
        }

        // Filter server changes to exclude pending records
        const safeChanges = {
            projects: {
                created: (rawChanges.projects?.created || []).filter((p: any) => {
                    const isPending = pendingByTable.projects.has(p.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered project CREATED: ${p.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.projects?.updated || []).filter((p: any) => {
                    const isPending = pendingByTable.projects.has(p.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered project UPDATED: ${p.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.projects?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.projects.has(id)
                    if (isPending) {
                        log(`   ⚠️ Filtered project DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },
            deployments: {
                created: (rawChanges.deployments?.created || []).filter((d: any) => {
                    const isPending = pendingByTable.deployments.has(d.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered deployment CREATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.deployments?.updated || []).filter((d: any) => {
                    const isPending = pendingByTable.deployments.has(d.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered deployment UPDATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.deployments?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.deployments.has(id)
                    if (isPending) {
                        log(`   ⚠️ Filtered deployment DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },

            devices: {
                created: (rawChanges.devices?.created || []).filter((d: any) => {
                    const isPending = pendingByTable.devices.has(d.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device CREATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.devices?.updated || []).filter((d: any) => {
                    const isPending = pendingByTable.devices.has(d.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device UPDATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.devices?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.devices.has(id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },
        }

        // Log filtering stats
        const totalFiltered =
            (rawChanges.projects?.created?.length || 0) - (safeChanges.projects.created.length) +
            (rawChanges.projects?.updated?.length || 0) - (safeChanges.projects.updated.length) +
            (rawChanges.projects?.deleted?.length || 0) - (safeChanges.projects.deleted.length) +
            (rawChanges.deployments?.created?.length || 0) - (safeChanges.deployments.created.length) +
            (rawChanges.deployments?.updated?.length || 0) - (safeChanges.deployments.updated.length) +
            (rawChanges.deployments?.deleted?.length || 0) - (safeChanges.deployments.deleted.length) +

            (rawChanges.devices?.created?.length || 0) - (safeChanges.devices.created.length) +
            (rawChanges.devices?.updated?.length || 0) - (safeChanges.devices.updated.length) +
            (rawChanges.devices?.deleted?.length || 0) - (safeChanges.devices.deleted.length)

        if (totalFiltered > 0) {
            log(`✅ Filtered ${totalFiltered} server changes with pending local modifications`)
        } else {
            log('✅ No pending changes, applying all server updates')
        }

        // Handle conflicts (if any)
        if (conflicts && conflicts.length > 0) {
            logWarn(`⚠️ ${conflicts.length} conflicts detected:`, conflicts)
            // TODO: Store conflicts for user resolution
            // For now, just log them
        }

        // Update last pull timestamp
        await database.write(async () => {
            await SyncStateService.set(
                SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP,
                timestamp.toString()
            )
        })

        // log(`✅ Pull complete - timestamp updated to ${timestamp}`)
    }

    /**
     * Sync this account's roles (#375)
     *
     * Reads every live role the server holds for this account, not only the
     * ones changed since a watermark, and makes the phone match it. The server
     * shows live rows only (user_roles_select_policy hides a soft-deleted one),
     * so a role taken away, or the lower of two roles in one scope that
     * ww-backend #248 soft-deleted, never reaches an incremental pull: it only
     * shows as absence. It is a handful of rows.
     *
     * A server role finds its local row by id, then by role and scope. The
     * second covers the creator's project_admin that createProject writes, and
     * rows pulled before #375, which carry local ids. A system role's scope is
     * NULL and matches NULL: the old lookup asked for '' and stored NULL, so
     * every full pull added a copy, and it left out the role, so two roles in
     * one scope shared a row. A new row takes the server's id.
     *
     * Every other local role of this account goes: a copy, or a role the
     * server no longer has. Kept are the creator's role in a project whose
     * CREATE has not reached the server, and everything when the server lists
     * no roles at all, which reads as a bad answer rather than as losing them
     * all. Other accounts' rows, from the member cache (#307) or an earlier
     * sign-in (#267), are not touched.
     */
    private async syncUserRoles(userId: string): Promise<void> {
        log('👥 Syncing user roles')

        const { data, error } = await getSupabaseClient()
            .from('user_roles')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)

        if (error || !Array.isArray(data)) {
            logCloudFailure('❌ Failed to sync user roles:', error)
            return
        }
        const live = data as any[]
        const sameRole = (local: UserRole, row: any) => local.role === row.role
            && local.scopeType === row.scope_type
            && (local.scopeId || null) === (row.scope_id || null)

        let added = 0
        let updated = 0
        let removed = 0
        await database.write(async () => {
            const collection = database.get<UserRole>('user_roles')
            const local = await collection.query(Q.where('user_id', userId)).fetch()

            // By id first, so a match by role and scope cannot take a row that
            // is another server role's own record
            const matched = new Map<any, UserRole>()
            const taken = new Set<string>()
            const claim = (row: any, mine: UserRole | undefined) => {
                if (!mine) return
                matched.set(row, mine)
                taken.add(mine.id)
            }
            for (const row of live) claim(row, local.find(r => r.id === row.id))
            for (const row of live) {
                if (!matched.has(row)) claim(row, local.find(r => !taken.has(r.id) && sameRole(r, row)))
            }

            const operations: any[] = []
            for (const row of live) {
                const mine = matched.get(row)
                const updatedAt = new Date(row.updated_at ?? Date.now())
                if (!mine) {
                    operations.push(collection.prepareCreate((rec) => {
                        rec._raw.id = row.id
                        rec.userId = row.user_id
                        rec.role = row.role
                        rec.scopeType = row.scope_type
                        rec.scopeId = row.scope_id
                        rec.grantedBy = row.granted_by
                        rec.grantedAt = new Date(row.granted_at ?? Date.now())
                        rec.expiresAt = row.expires_at ? new Date(row.expires_at) : undefined
                        rec.isActive = row.is_active
                        rec.modifiedBy = row.modified_by;
                        // Use _raw to bypass @readonly check
                        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime()
                        rec.updatedAt = updatedAt
                    }))
                    added++
                } else if (mine.role !== row.role || mine.isActive !== row.is_active
                    || (row.updated_at && Number(mine.updatedAt) !== updatedAt.getTime())) {
                    // A promotion changes the role on the same server row (#248)
                    operations.push(mine.prepareUpdate((rec) => {
                        rec.role = row.role
                        rec.isActive = row.is_active
                        rec.modifiedBy = row.modified_by
                        rec.updatedAt = updatedAt
                    }))
                    updated++
                }
            }

            const unmatched = local.filter(r => !taken.has(r.id))
            if (unmatched.length > 0 && live.length === 0) {
                logWarn(`⚠️ The server lists no roles for this account, kept the ${unmatched.length} on this phone`)
            } else if (unmatched.length > 0) {
                // The creator's role in a project still to be created on the server
                const createsQueued = new Set((await database.get<SyncOutbox>('sync_outbox')
                    .query(
                        Q.where('table_name', 'projects'),
                        Q.where('status', Q.oneOf(['pending', 'failed', 'syncing'])),
                    )
                    .fetch())
                    .filter(op => op.operationType.toUpperCase() === 'CREATE')
                    .map(op => op.recordId))
                for (const r of unmatched) {
                    if (r.scopeType === 'project' && !!r.scopeId && createsQueued.has(r.scopeId)) continue
                    operations.push(r.prepareDestroyPermanently())
                    removed++
                }
            }

            if (operations.length > 0) {
                await database.batch(...operations)
            }
        })

        // Sync missing user profiles
        if (live.length > 0) {
            await this.syncUserProfiles(Array.from(new Set(live.map(row => row.user_id as string))))
        }

        log(`✅ User roles sync complete: ${live.length} on the server, ${added} added, ${updated} updated, ${removed} removed here`)
    }

    /**
     * Fetch and store user profiles for a list of user IDs
     * Ensures that we have name/email for all roles we just synced
     */
    private async syncUserProfiles(userIds: string[]): Promise<void> {
        if (userIds.length === 0) return

        try {
            // Check which users we already have locally
            const localUsers = await database.get('users').query(Q.where('id', Q.oneOf(userIds))).fetch()
            const existingIds = new Set(localUsers.map(u => u.id))
            const missingIds = userIds.filter(id => !existingIds.has(id))

            if (missingIds.length === 0) return

            log(`👤 Fetching ${missingIds.length} missing user profiles...`)

            const { data: profiles, error } = await getSupabaseClient()
                .from('users')
                .select('*')
                .in('id', missingIds)

            if (error) {
                logCloudFailure('❌ Failed to fetch user profiles:', error)
                return
            }

            if (profiles && profiles.length > 0) {
                await database.write(async () => {
                    const collection = database.collections.get('users')
                    const operations = profiles.map(profile => 
                        collection.prepareCreate((rec: any) => {
                            rec._raw.id = profile.id
                            rec.firstname = profile.firstname
                            rec.surname = profile.surname
                            rec.modifiedBy = profile.modified_by || 'system'
                            rec._raw.created_at = new Date(profile.created_at || Date.now()).getTime()
                            rec._raw.updated_at = new Date(profile.updated_at || Date.now()).getTime()
                        })
                    )
                    await database.batch(operations)
                })
                log(`✅ Synced ${profiles.length} user profiles`)
            }
        } catch (e) {
            logCloudFailure('❌ Error syncing user profiles:', e)
        }
    }

    /**
     * Records of a table with a change still in the outbox, not yet on the
     * server (#349). An incremental pull must not write the server's row over
     * them: the row is older than the change, and on 1 October 2026 applying it
     * put a deployment's local photo path back over the uploaded one, which made
     * the next upload drop the photo (#347). The record comes back in a later
     * pull once the change is pushed. An outbox that cannot be read leaves the
     * pull as it was, applying every row.
     */
    private async unsyncedRecordIds(table: 'projects' | 'devices' | 'deployments'): Promise<Set<string>> {
        try {
            const ops = await database.collections.get<SyncOutbox>('sync_outbox')
                .query(
                    Q.where('table_name', table),
                    Q.where('status', Q.oneOf(['pending', 'failed', 'syncing'])),
                )
                .fetch()
            return new Set(ops.map(op => op.recordId))
        } catch (e) {
            logWarn(`[Sync] Could not read the outbox before the ${table} pull, so every row is applied:`, e)
            return new Set()
        }
    }

    /**
     * Sync projects (incremental pull)
     * Pulls projects that the user has access to via their user_roles
     */
    private async syncProjects(): Promise<boolean> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('📂 Syncing projects since', lastPulledAt)

        const client = getSupabaseClient()

        // Get current user
        const { data: { user } } = await client.auth.getUser()
        if (!user) {
            log('⚠️ No authenticated user, skipping project sync')
            return false
        }

        // Query projects using the projects_with_stats view which includes role information
        const { data, error } = await client
            .from('projects_with_stats')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logCloudFailure('❌ Failed to sync projects:', error)
            return false
        }

        if (!data || data.length === 0) {
            log('✅ No new project changes')
            return true
        }

        log(`📥 Received ${data.length} project updates`)

        const collection = database.collections.get<Project>('projects')
        const unsynced = await this.unsyncedRecordIds('projects')

        await database.write(async () => {
            for (const row of data) {
                // A change waiting in the outbox is newer than this row (#349)
                if (unsynced.has(row.id || '')) {
                    log(`⏸️ Kept the local project ${row.id}: a change to it is still waiting to be pushed`)
                    continue
                }
                // Skip projects that were deleted on server
                if (row.deleted_at) {
                    try {
                        const existing = await collection.find(row.id || '')
                        if (!existing._raw._status.includes('deleted')) {
                            await existing.markAsDeleted()
                        }
                    } catch (e) {
                        // Project doesn't exist locally, skip it
                    }
                    continue
                }

                // Check if exists
                try {
                    const existing = await collection.find(row.id || '')
                    await existing.update((rec) => {
                        rec.name = row.name || ''
                        rec.description = row.description || ''
                        rec.organisationId = row.organisation_id || ''
                        rec.samplingDesignId = row.sampling_design_id ?? undefined
                        rec.website = row.website ?? undefined
                        rec.isActive = row.is_active ?? true
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.modelId = row.model_id ?? undefined
                        rec.isBaited = row.is_baited ?? false
                        rec.isMonitoringMarkedIndividuals = row.is_monitoring_marked_individuals ?? false
                        rec.projectImage = row.project_image ?? undefined
                        // Capture flash: the deployment writes these to the device
                        // (op34/op13/op35/op36), so a project that never pulls them
                        // deploys with the flash off and no night IR (#282).
                        rec.flashMode = row.flash_mode ?? DEFAULT_FLASH_MODE
                        rec.flashLed = row.flash_led ?? DEFAULT_FLASH_LED
                        rec.flashWindowStartMinutesUtc = row.flash_window_start_minutes_utc ?? undefined
                        rec.flashWindowMinutes = row.flash_window_minutes ?? undefined
                        // Pictures per trigger and their interval, written as op5
                        // and op6 by the deployment (#317)
                        rec.photosPerTrigger = row.photos_per_trigger ?? DEFAULT_PHOTOS_PER_TRIGGER
                        rec.photoIntervalMilliseconds = row.photo_interval_milliseconds ?? DEFAULT_PHOTO_INTERVAL_MS
                        // Detection threshold, written as op16 by the deployment (#342)
                        rec.detectionThresholdPct = row.detection_threshold_pct ?? DEFAULT_DETECTION_THRESHOLD_PCT
                        // Pulled since #285: a GPS setting changed on the website never
                        // reached the phone, so its deployments zeroed GPS regardless
                        rec.recordGpsInImages = row.record_gps_in_images ?? false
                        rec.lorawanRequired = row.lorawan_required ?? false
                        rec.isArchived = row.is_archived ?? false
                        rec.createdBy = row.created_by || ''
                        rec.modifiedBy = row.modified_by || '';
                        // Use _raw to bypass @readonly check
                        (rec._raw as any).updated_at = new Date(row.updated_at ?? Date.now()).getTime()
                    })
                } catch (e) {
                    // Project doesn't exist, create it
                    await collection.create((rec) => {
                        rec._raw.id = row.id || '' // Set the ID from server
                        rec.name = row.name || ''
                        rec.description = row.description || ''
                        rec.organisationId = row.organisation_id || ''
                        rec.samplingDesignId = row.sampling_design_id ?? undefined
                        rec.website = row.website ?? undefined
                        rec.isActive = row.is_active ?? true
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.modelId = row.model_id ?? undefined
                        rec.isBaited = row.is_baited ?? false
                        rec.isMonitoringMarkedIndividuals = row.is_monitoring_marked_individuals ?? false
                        rec.projectImage = row.project_image ?? undefined
                        rec.flashMode = row.flash_mode ?? DEFAULT_FLASH_MODE
                        rec.flashLed = row.flash_led ?? DEFAULT_FLASH_LED
                        rec.flashWindowStartMinutesUtc = row.flash_window_start_minutes_utc ?? undefined
                        rec.flashWindowMinutes = row.flash_window_minutes ?? undefined
                        rec.photosPerTrigger = row.photos_per_trigger ?? DEFAULT_PHOTOS_PER_TRIGGER
                        rec.photoIntervalMilliseconds = row.photo_interval_milliseconds ?? DEFAULT_PHOTO_INTERVAL_MS
                        rec.detectionThresholdPct = row.detection_threshold_pct ?? DEFAULT_DETECTION_THRESHOLD_PCT
                        // Pulled since #285: a GPS setting changed on the website never
                        // reached the phone, so its deployments zeroed GPS regardless
                        rec.recordGpsInImages = row.record_gps_in_images ?? false
                        rec.lorawanRequired = row.lorawan_required ?? false
                        rec.isArchived = row.is_archived ?? false
                        rec.createdBy = row.created_by || ''
                        rec.modifiedBy = row.modified_by || '';
                        // Use _raw to bypass @readonly check
                        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime();
                        (rec._raw as any).updated_at = new Date(row.updated_at ?? Date.now()).getTime()
                    })
                }
            }
            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        log('✅ Projects sync complete')
        return true
    }

    /**
     * Sync devices (incremental pull)
     */
    private async syncDevices(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEVICES_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('📷 Syncing devices since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('devices')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logCloudFailure('❌ Failed to sync devices:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new device changes')
            return
        }

        log(`📥 Received ${data.length} device updates`)

        const unsynced = await this.unsyncedRecordIds('devices')

        await database.write(async () => {
            const collection = database.get<Device>('devices')

            // Explicitly type the row to match Supabase schema
            type DeviceRow = Database['public']['Tables']['devices']['Row']

            for (const row of data as DeviceRow[]) {
                if (!row) {
                    logError('[Sync] Found undefined row in devices data!')
                    continue
                }
                log(`[Sync] Processing device row: ${row.id}`) // Debug for TypeError

                // A change waiting in the outbox is newer than this row (#349)
                if (unsynced.has(row.id)) {
                    log(`⏸️ Kept the local device ${row.id}: a change to it is still waiting to be pushed`)
                    continue
                }

                // Check if exists
                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.organisationId = row.organisation_id ?? ''
                        rec.deviceEui = row.device_eui ?? undefined
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id || '' // Use server ID
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.organisationId = row.organisation_id ?? ''
                        rec.deviceEui = row.device_eui ?? undefined;
                        // Use _raw to bypass @readonly check
                        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime()
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                }
            }
            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        log('✅ Devices sync complete')
    }


    /**
     * Sync deployments (incremental pull)
     */
    private async syncDeployments(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEPLOYMENTS_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('⛺ Syncing deployments since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('deployments')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logCloudFailure('❌ Failed to sync deployments:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new deployment changes')
            return
        }

        log(`📥 Received ${data.length} deployment updates`)

        const unsynced = await this.unsyncedRecordIds('deployments')

        await database.write(async () => {
            const collection = database.get<Deployment>('deployments')

            for (const row of data) {
                // A change waiting in the outbox is newer than this row (#349)
                if (unsynced.has(row.id)) {
                    log(`⏸️ Kept the local deployment ${row.id}: a change to it is still waiting to be pushed`)
                    continue
                }
                // Skip if deleted on server
                if (row.deleted_at) {
                    try {
                        const existing = await collection.find(row.id)
                        if (!existing._raw._status.includes('deleted')) {
                            await existing.markAsDeleted()
                        }
                    } catch (e) {
                        // Doesn't exist locally, skip
                    }
                    continue
                }

                const projectId = row.project_id || ''

                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.projectId = projectId
                        rec.deviceId = row.device_id || ''

                        rec.deploymentStatusId = row.deployment_status_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined

                        rec.name = row.name ?? ''
                        rec.setupBy = row.setup_by || ''
                        rec.endedBy = row.ended_by ?? undefined

                        rec.locationName = row.location_name || ''
                        rec.location = row.location ?? {}
                        rec.latitude = row.latitude ?? undefined
                        rec.longitude = row.longitude ?? undefined
                        rec.altitude = row.altitude ?? undefined
                        rec.accuracy = row.accuracy ?? undefined
                        rec.locationDescription = row.location_description ?? undefined

                        rec.cameraLocationImagePaths = row.camera_location_image_paths
                        rec.cameraHeight = row.camera_height ?? undefined

                        rec.deploymentStart = row.deployment_start ? new Date(row.deployment_start) : rec.deploymentStart
                        rec.deploymentEnd = row.deployment_end ? new Date(row.deployment_end) : null

                        rec.startDeploymentComments = row.start_deployment_comments ?? undefined
                        rec.endDeploymentComments = row.end_deployment_comments ?? undefined

                        rec.modifiedBy = (row as any).modified_by ?? ''
                        if (row.deployment_photos != null) {
                            rec.deploymentPhotos = row.deployment_photos
                        }

                        const raw = rec._raw as any;
                        raw.updated_at = this.parseDateToTimestamp(row.updated_at);
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id // Use server ID

                        rec.projectId = projectId
                        rec.deviceId = row.device_id || ''

                        rec.deploymentStatusId = row.deployment_status_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined

                        rec.name = row.name ?? ''
                        rec.setupBy = row.setup_by || ''
                        rec.endedBy = row.ended_by ?? undefined

                        rec.locationName = row.location_name || ''
                        rec.location = row.location ?? {}
                        rec.latitude = row.latitude ?? undefined
                        rec.longitude = row.longitude ?? undefined
                        rec.altitude = row.altitude ?? undefined
                        rec.accuracy = row.accuracy ?? undefined
                        rec.locationDescription = row.location_description ?? undefined

                        rec.cameraLocationImagePaths = row.camera_location_image_paths
                        rec.cameraHeight = row.camera_height ?? undefined

                        rec.deploymentStart = new Date(row.deployment_start)
                        rec.deploymentEnd = row.deployment_end ? new Date(row.deployment_end) : null

                        rec.startDeploymentComments = row.start_deployment_comments ?? undefined
                        rec.endDeploymentComments = row.end_deployment_comments ?? undefined

                        rec.modifiedBy = (row as any).modified_by ?? ''
                        rec.deploymentPhotos = row.deployment_photos ?? []

                        const raw = rec._raw as any;
                        raw.created_at = this.parseDateToTimestamp(row.created_at);
                        raw.updated_at = this.parseDateToTimestamp(row.updated_at);
                    })
                }
            }

            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => this.parseDateToTimestamp(d.updated_at)))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        log('✅ Deployments sync complete')
    }

    private parseDateToTimestamp(dateInput: any): number {
        try {
            if (!dateInput) return Date.now()
            if (typeof dateInput === 'number') return dateInput
            if (typeof dateInput === 'string') return new Date(dateInput).getTime()
            if (dateInput instanceof Date) return dateInput.getTime()
            return Date.now()
        } catch (e) {
            return Date.now()
        }
    }


    async startRealtimeSubscription() {
        const client = getSupabaseClient()

        if (this.realtimeChannel) {
            return
        }

        // Listen to changes on the 'projects' and 'deployments' tables
        // We can use a wildcard for the schema to catch all changes
        this.realtimeChannel = client
            .channel('public:db_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    log('📡 Realtime change received:', payload.table, payload.eventType)
                    // Use debounced sync to avoid thrashing
                    this.debouncedSync()
                }
            )
            .subscribe()

        log('📡 Realtime subscription started (debounced)')
    }

    async stopRealtimeSubscription() {
        if (this.realtimeChannel) {
            await this.realtimeChannel.unsubscribe()
            this.realtimeChannel = null
        }

        // Clear any pending debounced sync
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
            this.syncDebounceTimer = null
        }

        log('📡 Realtime subscription stopped')
    }
}

export default new SupabaseSyncService()
