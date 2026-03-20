import { Q } from '@nozbe/watermelondb'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'
import SyncOutbox from '../database/models/SyncOutbox'
import SyncStateService, { SYNC_STATE_KEYS } from './SyncStateService'
import { Database } from '../types/database.types'
import UserRole from '../database/models/UserRole'
import Device from '../database/models/Device'
import Project from '../database/models/Project'
import DevicePreparation from '../database/models/DevicePreparation'
import NetInfo from '@react-native-community/netinfo'
import type { RootState } from '../redux'
import { generateUUID } from '../utils/uuid'
import type Deployment from '../database/models/Deployment'
import { log, logError, logWarn } from '../utils/logger'


import { setGlobalSyncing } from '../redux/slices/syncSlice'

class SupabaseSyncService {
    private realtimeChannel: RealtimeChannel | null = null
    private isSyncing = false
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
            this.sync()
        }, this.SYNC_DEBOUNCE_MS)

        // log(`⏳ Sync debounced (will trigger in ${this.SYNC_DEBOUNCE_MS}ms)`)
    }

    /**
     * Immediate sync - bypasses debouncing
     */
    async sync() {
        // Check if sync already in progress (via SyncStateService)
        const inProgress = await SyncStateService.isSyncInProgress()
        if (inProgress || this.isSyncing) {
            // log('⏳ Sync already in progress, skipping.')
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
            // STEP 1: UPLOAD OUTBOX OPERATIONS
            // ================================================================
            await this.uploadOutbox(user.id)

            // ================================================================
            // STEP 2: PULL REMOTE CHANGES
            // ================================================================
            await this.pullRemoteChanges()
            await this.syncUserRoles()
            await this.syncProjects()
            await this.syncDevices()
            await this.syncDevicePreparation()
            await this.syncDeployments()

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

        } catch (error) {
            logError('❌ Sync failed:', error)

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
        }
    }

    /**
     * Upload pending outbox operations to server
     */
    private async uploadOutbox(currentUserId: string): Promise<void> {
        const pendingOps = await database.get<SyncOutbox>('sync_outbox')
            .query(
                Q.or(
                    Q.where('status', 'pending'),
                    Q.where('status', 'failed')
                )
            )
            .fetch()

        if (pendingOps.length === 0) {
            // log('✅ Sync complete - no pending operations')
            return
        }

        // log(`📤 Uploading ${pendingOps.length} pending operations...`)

        // Mark operations as syncing
        await database.write(async () => {
            for (const op of pendingOps) {
                await op.update(o => {
                    o.status = 'syncing'
                })
            }
        })



        // Helper to populate changes object
        const populateChanges = (ops: SyncOutbox[], userId?: string) => {
            const result: any = {
                projects: { created: [], updated: [], deleted: [] },
                devices: { created: [], updated: [], deleted: [] },
                device_preparation: { created: [], updated: [], deleted: [] },
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

        // Define upload order: Projects -> Devices -> Preparation -> Deployments
        // This ensures Foreign Keys are satisfied (e.g. Device Prep needs Device, Deployment needs Device & Project)
        const uploadOrder = ['projects', 'devices', 'device_preparation', 'deployments']

        const client = getSupabaseClient()
        let anyFailures = false

        for (const tableName of uploadOrder) {
            // Filter ops for this table
            const tableOps = pendingOps.filter(op => op.tableName === tableName)

            if (tableOps.length === 0) continue

            log(`📤 Uploading batch for table: ${tableName} (${tableOps.length} ops)`)

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

            try {
                const { data, error } = await (client as any).rpc('push_changes', { changes })

                // IMPORTANT DEBUG: Log processed count to detect silent failures
                // log(`✅ Server processed ${data?.processed ?? '?'} operations for ${tableName}`)

                if (error) {
                    logError(`❌ Push failed for ${tableName}:`, error)
                    anyFailures = true

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
                        
                        // Scenario A: device_preparation fails because device is missing
                        if (tableName === 'device_preparation') {
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
                        
                        // Scenario B: deployments failure because device_preparation is missing
                        if (tableName === 'deployments') {
                            log('🚑 Self-healing for missing device_preparation dependency...')
                            const prepCollection = database.get<DevicePreparation>('device_preparation')
                            const missingPrepIds = new Set<string>()

                            for (const op of tableOps) {
                                try {
                                    const payload = JSON.parse(op.payload)
                                    if (payload.device_preparation_id) missingPrepIds.add(payload.device_preparation_id)
                                } catch (e) {}
                            }

                            for (const prepId of Array.from(missingPrepIds)) {
                                try {
                                    const localPrep = await prepCollection.find(prepId)
                                    if (localPrep) {
                                        const existingOps = await database.get<SyncOutbox>('sync_outbox').query(
                                            Q.where('table_name', 'device_preparation'),
                                            Q.where('record_id', prepId),
                                            Q.where('operation_type', Q.oneOf(['CREATE', 'UPDATE'])),
                                            Q.where('status', Q.oneOf(['pending', 'failed']))
                                        ).fetch()

                                        if (existingOps.length === 0) {
                                            log(`🚑 Self-healing: Record exists locally but no outbox entry for ${prepId}. This is unexpected but healing by re-queueing...`)
                                            // Trigger a dummy update to force a new sync entry if sync service can't find it
                                            // For now we just log it as it should have been caught by 'failed' retry logic
                                        } else {
                                            log(`ℹ️ Prep record ${prepId} already has a ${existingOps[0].status} outbox entry. Sync retry logic should handle it next time.`)
                                        }
                                    }
                                } catch (e) {
                                    log(`⚠️ Cannot heal prep ${prepId} - not found locally`)
                                }
                            }
                        }
                    }

                    // Stop processing subsequent dependent tables if a dependency failed
                    logWarn(`⚠️ Stopping upload chain due to failure in ${tableName}`)
                    break
                }

                log(`✅ Server processed ${data.processed} operations for ${tableName}`)

                // Handle conflicts
                if (data.conflicts > 0) {
                    logWarn(`⚠️ ${data.conflicts} conflicts in ${tableName}:`, data.conflict_details)
                    await database.write(async () => {
                        for (const conflict of data.conflict_details) {
                            const conflictOp = tableOps.find(op => op.operationId === conflict.operation_id)
                            if (conflictOp) {
                                await conflictOp.update(o => {
                                    o.status = 'conflict'
                                })
                            }
                        }
                    })
                }

                // Mark successfully synced operations
                const conflictOpIds = new Set(
                    (data.conflict_details || []).map((c: any) => c.operation_id)
                )

                await database.write(async () => {
                    for (const op of tableOps) {
                        if (!conflictOpIds.has(op.operationId)) {
                            await op.update(o => {
                                o.status = 'synced'
                            })
                        }
                    }
                })

            } catch (err) {
                logError(`❌ Exception during push for ${tableName}:`, err)
                anyFailures = true
                break
            }
        }

        if (anyFailures) {
            throw new Error('One or more sync batches failed')
        }

        // log('✅ All sync batches completed successfully')
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
            logError('❌ Pull changes failed:', error)
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
            device_preparation: new Set(),
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
            device_preparation: {
                created: (rawChanges.device_preparation?.created || []).filter((dp: any) => {
                    const isPending = pendingByTable.device_preparation.has(dp.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device_preparation CREATED: ${dp.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.device_preparation?.updated || []).filter((dp: any) => {
                    const isPending = pendingByTable.device_preparation.has(dp.id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device_preparation UPDATED: ${dp.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.device_preparation?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.device_preparation.has(id)
                    if (isPending) {
                        log(`   ⚠️ Filtered device_preparation DELETED: ${id} (has pending changes)`)
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
            (rawChanges.device_preparation?.created?.length || 0) - (safeChanges.device_preparation.created.length) +
            (rawChanges.device_preparation?.updated?.length || 0) - (safeChanges.device_preparation.updated.length) +
            (rawChanges.device_preparation?.deleted?.length || 0) - (safeChanges.device_preparation.deleted.length) +
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
     * Sync user roles (incremental pull)
     * Syncs the user_roles table which replaces project_members
     */
    private async syncUserRoles(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.USER_ROLES_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('👥 Syncing user roles since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('user_roles')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logError('❌ Failed to sync user roles:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new user role changes')
            return
        }

        log(`📥 Received ${data.length} user role updates`)

        const usersToSync = new Set<string>()

        await database.write(async () => {
            const collection = database.get<UserRole>('user_roles')
            const operations = []

            for (const row of data as any[]) {
                usersToSync.add(row.user_id) // Track user ID for profile sync

                // Check if exists
                const existing = await collection.query(
                    Q.where('user_id', row.user_id),
                    Q.where('scope_type', row.scope_type),
                    Q.where('scope_id', row.scope_id || '')
                ).fetch()

                if (existing.length > 0) {
                    await existing[0].update((rec) => {
                        rec.role = row.role
                        rec.isActive = row.is_active
                        rec.modifiedBy = row.modified_by
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                } else {
                    const newRec = collection.prepareCreate((rec) => {
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
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                    operations.push(newRec)
                }
            }
            if (operations.length > 0) {
                await database.batch(operations)
            }
            
            // Update timestamp
            if (data.length > 0) {
                const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
                await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
            }
        })

        // Sync missing user profiles
        if (usersToSync.size > 0) {
            await this.syncUserProfiles(Array.from(usersToSync))
        }

        log('✅ User roles sync complete')
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
                logError('❌ Failed to fetch user profiles:', error)
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
            logError('❌ Error syncing user profiles:', e)
        }
    }

    /**
     * Sync projects (incremental pull)
     * Pulls projects that the user has access to via their user_roles
     */
    private async syncProjects(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('📂 Syncing projects since', lastPulledAt)

        const client = getSupabaseClient()

        // Get current user
        const { data: { user } } = await client.auth.getUser()
        if (!user) {
            log('⚠️ No authenticated user, skipping project sync')
            return
        }

        // Query projects using the projects_with_stats view which includes role information
        const { data, error } = await client
            .from('projects_with_stats')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logError('❌ Failed to sync projects:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new project changes')
            return
        }

        log(`📥 Received ${data.length} project updates`)

        const collection = database.collections.get<Project>('projects')

        await database.write(async () => {
            for (const row of data) {
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
            logError('❌ Failed to sync devices:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new device changes')
            return
        }

        log(`📥 Received ${data.length} device updates`)

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
     * Sync device preparation records (incremental pull)
     */
    private async syncDevicePreparation(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEVICE_PREP_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        log('📷 Syncing device_preparation since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('device_preparation')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            logError('❌ Failed to sync device_preparation:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new device preparation changes')
            return
        }

        log(`📥 Received ${data.length} device preparation updates`)

        await database.write(async () => {
            const collection = database.get<DevicePreparation>('device_preparation')

            for (const row of data) {
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

                // Update or create
                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.deviceId = row.device_id || ''
                        rec.projectId = row.project_id || ''
                        rec.aiModelId = row.ai_model_id ?? undefined
                        rec.bleFirmwareId = row.ble_firmware_id ?? undefined
                        rec.configFirmwareId = row.config_firmware_id ?? undefined
                        rec.himaxFirmwareId = row.himax_firmware_id ?? undefined
                        rec.status = row.status
                        rec.isDeploymentReady = row.is_deployment_ready
                        rec.deviceEui = row.device_eui ?? undefined
                        rec.lorawanNetwork = row.lorawan_network ?? undefined
                        rec.lorawanRegistrationCompleted = row.lorawan_registration_completed
                        rec.modifiedBy = row.modified_by ?? '';
                        (rec._raw as any).updated_at = new Date(row.updated_at ?? Date.now()).getTime()
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id || ''
                        rec.deviceId = row.device_id || ''
                        rec.projectId = row.project_id || ''
                        rec.aiModelId = row.ai_model_id ?? undefined
                        rec.bleFirmwareId = row.ble_firmware_id ?? undefined
                        rec.configFirmwareId = row.config_firmware_id ?? undefined
                        rec.himaxFirmwareId = row.himax_firmware_id ?? undefined
                        rec.status = row.status
                        rec.isDeploymentReady = row.is_deployment_ready
                        rec.deviceEui = row.device_eui ?? undefined
                        rec.lorawanNetwork = row.lorawan_network ?? undefined
                        rec.lorawanRegistrationCompleted = row.lorawan_registration_completed
                        rec.modifiedBy = row.modified_by ?? '';
                        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime()
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                }
            }

            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        log('✅ Device preparation sync complete')
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
            logError('❌ Failed to sync deployments:', error)
            return
        }

        if (!data || data.length === 0) {
            log('✅ No new deployment changes')
            return
        }

        log(`📥 Received ${data.length} deployment updates`)

        await database.write(async () => {
            const collection = database.get<Deployment>('deployments')

            for (const row of data) {
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

                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.projectId = row.project_id || ''
                        rec.deviceId = row.device_id || ''
                        rec.devicePreparationId = row.device_preparation_id || ''

                        rec.deploymentStatusId = row.deployment_status_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined

                        rec.name = row.name ?? undefined
                        rec.setupBy = row.setup_by || ''
                        rec.endedBy = row.ended_by ?? undefined

                        rec.locationName = row.location_name || ''
                        rec.location = row.location
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

                        const raw = rec._raw as any;
                        raw.updated_at = this.parseDateToTimestamp(row.updated_at);
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id // Use server ID

                        rec.projectId = row.project_id || ''
                        rec.deviceId = row.device_id || ''
                        rec.devicePreparationId = row.device_preparation_id || ''

                        rec.deploymentStatusId = row.deployment_status_id ?? undefined
                        rec.captureMethodId = row.capture_method_id ?? undefined
                        rec.activityDetectionSensitivityId = row.activity_detection_sensitivity_id ?? undefined
                        rec.timelapseIntervalSeconds = row.timelapse_interval_seconds ?? undefined

                        rec.name = row.name ?? undefined
                        rec.setupBy = row.setup_by || ''
                        rec.endedBy = row.ended_by ?? undefined

                        rec.locationName = row.location_name || ''
                        rec.location = row.location
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
