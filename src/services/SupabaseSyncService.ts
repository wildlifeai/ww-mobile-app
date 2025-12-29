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

class SupabaseSyncService {
    private realtimeChannel: RealtimeChannel | null = null
    private isSyncing = false
    private syncDebounceTimer: NodeJS.Timeout | null = null
    private readonly SYNC_DEBOUNCE_MS = 2000 // 2 seconds

    /**
     * Reset sync state on app startup
     * Clears any stuck "in progress" flags from previous crashes
     */
    async resetSyncState() {
        console.log('🔄 Resetting sync state...')

        // INTEGRITY CHECK: Detect DB Reset (e.g. after migration failure)
        // If the DB is missing the timestamp record but AsyncStorage has it, we interpret this as a reset/inconsistency.
        try {
            const lastPullTs = await SyncStateService.getLastPullTimestamp()
            if (lastPullTs > 0) {
                const dbRecords = await database.get('sync_state')
                    .query(Q.where('key', SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP))
                    .fetch()

                if (dbRecords.length === 0) {
                    console.warn('⚠️ [SupabaseSyncService] Detected zombie LAST_PULL_TIMESTAMP in cache (missing in DB). Clearing AsyncStorage sync cache.')
                    await SyncStateService.clearAllState()
                }
            }
        } catch (e) {
            console.error('⚠️ [SupabaseSyncService] Failed to check integrity:', e)
        }

        this.isSyncing = false
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer)
            this.syncDebounceTimer = null
        }

        await database.write(async () => {
            await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'false')
        })
        console.log('✅ Sync state reset complete')
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
            console.log('⏰ Debounce timer expired, triggering sync...')
            this.sync()
        }, this.SYNC_DEBOUNCE_MS)

        console.log(`⏳ Sync debounced (will trigger in ${this.SYNC_DEBOUNCE_MS}ms)`)
    }

    /**
     * Immediate sync - bypasses debouncing
     */
    async sync() {
        // Check if sync already in progress (via SyncStateService)
        const inProgress = await SyncStateService.isSyncInProgress()
        if (inProgress || this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping.')
            return
        }

        // Check network state - don't sync if offline
        // Try Redux first (maintained by OfflineService), but fallback to NetInfo if offline
        // This handles the race condition where Redux hasn't initialized yet
        let isOnline = false
        try {
            const { default: store } = require('../redux')
            const state: RootState = store.getState()
            isOnline = state.network.isOnline

            // If Redux says offline, double-check with NetInfo (handles initialization race)
            if (!isOnline) {
                const netState = await NetInfo.fetch()
                const netInfoOnline = netState.isConnected === true
                if (netInfoOnline) {
                    console.log(`🌐 Network check: Redux says OFFLINE but NetInfo says ONLINE - using NetInfo`)
                    isOnline = true
                } else {
                    console.log(`🌐 Network check (Redux): OFFLINE`)
                }
            } else {
                console.log(`🌐 Network check (Redux): ONLINE`)
            }
        } catch (e) {
            // Fallback to NetInfo if Redux not available
            const netState = await NetInfo.fetch()
            isOnline = netState.isConnected === true
            console.log(`🌐 Network check (NetInfo fallback): ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
        }

        if (!isOnline) {
            console.log('⏸️ Device is offline - skipping sync')
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
                console.log(`👤 Auth user check attempt ${attempts} failed, retrying in ${RETRY_DELAY_MS}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
            }
        }

        if (!user) {
            console.log('👤 No authenticated user found after retries - skipping sync')
            return
        }

        this.isSyncing = true
        await database.write(async () => {
            await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'true')
        })
        const syncStartTime = Date.now()

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
            const syncEndTime = Date.now()
            const syncDuration = syncEndTime - syncStartTime

            await database.write(async () => {
                await SyncStateService.set(
                    SYNC_STATE_KEYS.LAST_SYNCED_AT,
                    syncEndTime.toString()
                )
                await SyncStateService.delete(SYNC_STATE_KEYS.LAST_SYNC_ERROR)

                const currentCount = await SyncStateService.get(SYNC_STATE_KEYS.TOTAL_SYNCS)
                const syncCount = currentCount ? parseInt(currentCount, 10) + 1 : 1
                await SyncStateService.set(SYNC_STATE_KEYS.TOTAL_SYNCS, syncCount.toString())

                console.log(`✅ Sync completed successfully in ${syncDuration}ms (total syncs: ${syncCount})`)
            })

        } catch (error) {
            console.error('❌ Sync failed:', error)

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
        }
    }

    /**
     * Upload pending outbox operations to server
     */
    private async uploadOutbox(currentUserId: string): Promise<void> {
        const pendingOps = await database.get<SyncOutbox>('sync_outbox')
            .query(Q.where('status', 'pending'))
            .fetch()

        if (pendingOps.length === 0) {
            console.log('✅ Sync complete - no pending operations')
            return
        }

        console.log(`📤 Uploading ${pendingOps.length} pending operations...`)

        // Mark operations as syncing
        await database.write(async () => {
            for (const op of pendingOps) {
                await op.update(o => {
                    o.status = 'syncing'
                })
            }
        })

        // Group operations by table and operation type
        const allChanges: any = {
            projects: { created: [], updated: [], deleted: [] },
            devices: { created: [], updated: [], deleted: [] },
            device_preparation: { created: [], updated: [], deleted: [] },
            deployments: { created: [], updated: [], deleted: [] },
        }

        // Helper to populate changes object
        const populateChanges = (ops: SyncOutbox[], currentUserId?: string) => {
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
                if (currentUserId) {
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
                        if (payload[field] && payload[field] !== currentUserId) {
                            // Don't patch created_by on updates if it's already a valid lookin UUID 
                            // (actually in this specific app context, patching is safer to bridge environment gaps)
                            console.log(`🔧 Patching ${tableName}.${field} from ${payload[field]} to ${currentUserId}`)
                            payload[field] = currentUserId
                            patched = true
                        }
                    })

                    if (patched) {
                        console.log(`✅ Patched audit fields for ${tableName} ${operationType} (internal ID: ${op.recordId})`)
                    }
                }

                // SECURITY/CRITICAL: Ensure deployments does NOT have modified_by as it's missing on server
                if (tableName === 'deployments') {
                    console.log(`🔍 Processing deployments payload. Has modified_by: ${'modified_by' in payload}`)
                    if ('modified_by' in payload) {
                        console.log(`🔧 Removing modified_by from deployments payload (value was: ${payload.modified_by})`)
                        delete payload.modified_by
                        console.log(`✅ modified_by removed. Still present: ${'modified_by' in payload}`)
                    } else {
                        console.log(`ℹ️ No modified_by in payload for deployments. Keys: ${Object.keys(payload).join(', ')}`)
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

            console.log(`📤 Uploading batch for table: ${tableName} (${tableOps.length} ops)`)

            // Build changes object just for this table
            // We pass the full structure but only populate the current table
            const changes = populateChanges(tableOps, currentUserId)

            console.log(`🔍 DEBUG: Payload for ${tableName}:`, JSON.stringify(changes))

            // CRITICAL FIX: Remove modified_by from deployments at batch level (server-side adds it)
            if (tableName === 'deployments') {
                ['created', 'updated'].forEach(opType => {
                    if (changes.deployments[opType]) {
                        changes.deployments[opType].forEach((record: any) => {
                            if ('modified_by' in record) {
                                console.log(`🔧 [BATCH-LEVEL] Removing modified_by from deployment ${record.id}`)
                                delete record.modified_by
                            }
                        })
                    }
                })
            }

            try {
                const { data, error } = await (client as any).rpc('push_changes', { changes })

                // IMPORTANT DEBUG: Log processed count to detect silent failures
                console.log(`✅ Server processed ${data?.processed ?? '?'} operations for ${tableName}`)

                if (error) {
                    console.error(`❌ Push failed for ${tableName}:`, error)
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

                    // SPECIAL HANDLING: Self-healing for Device Preparation Foreign Key errors (23503)
                    // If device_preparation fails because device doesn't exist on server, 
                    // check if we have it locally and queue a creation for it.
                    if (tableName === 'device_preparation' && error.code === '23503') {
                        console.log('🚑 Attempting self-healing for missing device dependency...')
                        const devicesCollection = database.get<Device>('devices')
                        const missingDeviceIds = new Set<string>()

                        // Extract device_ids from failed preparation ops
                        for (const op of tableOps) {
                            try {
                                const payload = JSON.parse(op.payload)
                                if (payload.device_id) {
                                    missingDeviceIds.add(payload.device_id)
                                }
                            } catch (e) {
                                // ignore parse check
                            }
                        }

                        // Check which ones exist locally but might not have synced
                        for (const deviceId of Array.from(missingDeviceIds)) {
                            try {
                                const localDevice = await devicesCollection.find(deviceId)
                                if (localDevice) {
                                    // Check if there's already a pending create op for this device
                                    const existingOps = await database.get<SyncOutbox>('sync_outbox').query(
                                        Q.where('table_name', 'devices'),
                                        Q.where('record_id', deviceId),
                                        Q.where('operation_type', 'CREATE'),
                                        Q.where('status', 'pending')
                                    ).fetch()

                                    if (existingOps.length === 0) {
                                        console.log(`🚑 Self-healing: Queueing CREATE for missing device ${deviceId}`)
                                        await database.write(async () => {
                                            // Re-queue device creation properly
                                            // We use direct interaction with OutboxService logic here to avoid circular dep if possible,
                                            // or just manual record creation since we are in a write block
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
                                                    battery_level: localDevice.batteryLevel,
                                                    ble_firmware_id: localDevice.bleFirmwareId || null,
                                                    config_firmware_id: localDevice.configFirmwareId || null,
                                                    himax_firmware_id: localDevice.himaxFirmwareId || null,
                                                    last_battery_check: localDevice.lastBatteryCheck || null,
                                                    last_sd_card_check: localDevice.lastSdCardCheck || null,
                                                    modified_by: currentUserId
                                                })
                                                op.version = 0
                                                op.lamportClock = Date.now()
                                                op.retryCount = 0
                                                op.status = 'pending'
                                            })
                                        })
                                    } else {
                                        console.log(`ℹ️ Pending CREATE op already exists for device ${deviceId}, it normally should have run first.`)
                                        // If it exists but we still failed, maybe it failed too? 
                                        // The loop logic processes 'devices' before 'device_preparation', so if it failed, it would have stopped chain.
                                        // If it succeeded, we shouldn't be here. 
                                        // Unless checking for 'pending' is wrong because it's now 'failed'?
                                    }
                                }
                            } catch (e) {
                                // Device not found locally, cannot heal
                                console.log(`⚠️ Cannot heal device ${deviceId} - not found locally (Caught error: ${e})`)
                            }
                        }
                    }

                    // Stop processing subsequent dependent tables if a dependency failed
                    console.warn(`⚠️ Stopping upload chain due to failure in ${tableName}`)
                    break
                }

                console.log(`✅ Server processed ${data.processed} operations for ${tableName}`)

                // Handle conflicts
                if (data.conflicts > 0) {
                    console.warn(`⚠️ ${data.conflicts} conflicts in ${tableName}:`, data.conflict_details)
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
                console.error(`❌ Exception during push for ${tableName}:`, err)
                anyFailures = true
                break
            }
        }

        if (anyFailures) {
            throw new Error('One or more sync batches failed')
        }

        console.log('✅ All sync batches completed successfully')
    }

    /**
     * Pull remote changes from server
     */
    private async pullRemoteChanges(): Promise<void> {
        const lastPulledStr = await SyncStateService.get(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)
        const lastPulledAt = lastPulledStr ? parseInt(lastPulledStr, 10) : 0

        console.log('🔽 Pulling changes since', lastPulledAt)
        const client = getSupabaseClient()

        const { data, error } = await (client as any).rpc('pull_changes', {
            last_pulled_at: lastPulledAt
        })

        if (error) {
            console.error('❌ Pull changes failed:', error)
            throw error
        }

        const { changes: rawChanges, conflicts, timestamp } = data as any

        // ================================================================
        // CRITICAL: Filter out records with pending local changes
        // ================================================================
        console.log('🔍 Filtering pending local changes from server updates...')

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

        console.log(`📦 Found ${pendingOps.length} pending operations in outbox:`)
        for (const [table, ids] of Object.entries(pendingByTable)) {
            if (ids.size > 0) {
                console.log(`   - ${table}: ${ids.size} pending`)
            }
        }

        // Filter server changes to exclude pending records
        const safeChanges = {
            projects: {
                created: (rawChanges.projects?.created || []).filter((p: any) => {
                    const isPending = pendingByTable.projects.has(p.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered project CREATED: ${p.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.projects?.updated || []).filter((p: any) => {
                    const isPending = pendingByTable.projects.has(p.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered project UPDATED: ${p.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.projects?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.projects.has(id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered project DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },
            deployments: {
                created: (rawChanges.deployments?.created || []).filter((d: any) => {
                    const isPending = pendingByTable.deployments.has(d.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered deployment CREATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.deployments?.updated || []).filter((d: any) => {
                    const isPending = pendingByTable.deployments.has(d.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered deployment UPDATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.deployments?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.deployments.has(id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered deployment DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },
            device_preparation: {
                created: (rawChanges.device_preparation?.created || []).filter((dp: any) => {
                    const isPending = pendingByTable.device_preparation.has(dp.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device_preparation CREATED: ${dp.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.device_preparation?.updated || []).filter((dp: any) => {
                    const isPending = pendingByTable.device_preparation.has(dp.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device_preparation UPDATED: ${dp.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.device_preparation?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.device_preparation.has(id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device_preparation DELETED: ${id} (has pending changes)`)
                    }
                    return !isPending
                }),
            },
            devices: {
                created: (rawChanges.devices?.created || []).filter((d: any) => {
                    const isPending = pendingByTable.devices.has(d.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device CREATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                updated: (rawChanges.devices?.updated || []).filter((d: any) => {
                    const isPending = pendingByTable.devices.has(d.id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device UPDATED: ${d.id} (has pending changes)`)
                    }
                    return !isPending
                }),
                deleted: (rawChanges.devices?.deleted || []).filter((id: string) => {
                    const isPending = pendingByTable.devices.has(id)
                    if (isPending) {
                        console.log(`   ⚠️ Filtered device DELETED: ${id} (has pending changes)`)
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
            console.log(`✅ Filtered ${totalFiltered} server changes with pending local modifications`)
        } else {
            console.log('✅ No pending changes, applying all server updates')
        }

        // Handle conflicts (if any)
        if (conflicts && conflicts.length > 0) {
            console.warn(`⚠️ ${conflicts.length} conflicts detected:`, conflicts)
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

        console.log(`✅ Pull complete - timestamp updated to ${timestamp}`)
    }

    /**
     * Sync user roles (incremental pull)
     * Syncs the user_roles table which replaces project_members
     */
    private async syncUserRoles(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.USER_ROLES_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        console.log('👥 Syncing user roles since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('user_roles')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            console.error('❌ Failed to sync user roles:', error)
            return
        }

        if (!data || data.length === 0) {
            console.log('✅ No new user role changes')
            return
        }

        console.log(`📥 Received ${data.length} user role updates`)

        await database.write(async () => {
            const collection = database.get<UserRole>('user_roles')

            for (const row of data as any[]) {
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
                    await collection.create((rec) => {
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
                }
            }
            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        console.log('✅ User roles sync complete')
    }

    /**
     * Sync projects (incremental pull)
     * Pulls projects that the user has access to via their user_roles
     */
    private async syncProjects(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        console.log('📂 Syncing projects since', lastPulledAt)

        const client = getSupabaseClient()

        // Get current user
        const { data: { user } } = await client.auth.getUser()
        if (!user) {
            console.log('⚠️ No authenticated user, skipping project sync')
            return
        }

        // Query projects using the projects_with_stats view which includes role information
        const { data, error } = await client
            .from('projects_with_stats')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            console.error('❌ Failed to sync projects:', error)
            return
        }

        if (!data || data.length === 0) {
            console.log('✅ No new project changes')
            return
        }

        console.log(`📥 Received ${data.length} project updates`)

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

        console.log('✅ Projects sync complete')
    }

    /**
     * Sync devices (incremental pull)
     */
    private async syncDevices(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEVICES_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        console.log('📷 Syncing devices since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('devices')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            console.error('❌ Failed to sync devices:', error)
            return
        }

        if (!data || data.length === 0) {
            console.log('✅ No new device changes')
            return
        }

        console.log(`📥 Received ${data.length} device updates`)

        await database.write(async () => {
            const collection = database.get<Device>('devices')

            // Explicitly type the row to match Supabase schema
            type DeviceRow = Database['public']['Tables']['devices']['Row']

            for (const row of data as DeviceRow[]) {
                if (!row) {
                    console.error('[Sync] Found undefined row in devices data!')
                    continue
                }
                console.log(`[Sync] Processing device row: ${row.id}`) // Debug for TypeError

                // Check if exists
                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.batteryLevel = row.battery_level ?? 0
                        rec.organisationId = row.organisation_id ?? ''
                        rec.bleFirmwareId = row.ble_firmware_id ?? undefined
                        rec.configFirmwareId = row.config_firmware_id ?? undefined
                        rec.himaxFirmwareId = row.himax_firmware_id ?? undefined
                        rec.lastBatteryCheck = row.last_battery_check ?? ''
                        rec.lastSdCardCheck = row.last_sd_card_check ?? ''
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id || '' // Use server ID
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.batteryLevel = row.battery_level ?? 0
                        rec.organisationId = row.organisation_id ?? ''
                        rec.bleFirmwareId = row.ble_firmware_id ?? undefined
                        rec.configFirmwareId = row.config_firmware_id ?? undefined
                        rec.himaxFirmwareId = row.himax_firmware_id ?? undefined
                        rec.lastBatteryCheck = row.last_battery_check ?? ''
                        rec.lastSdCardCheck = row.last_sd_card_check ?? '';
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

        console.log('✅ Devices sync complete')
    }

    /**
     * Sync device preparation records (incremental pull)
     */
    private async syncDevicePreparation(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEVICE_PREP_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        console.log('📷 Syncing device_preparation since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('device_preparation')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            console.error('❌ Failed to sync device_preparation:', error)
            return
        }

        if (!data || data.length === 0) {
            console.log('✅ No new device preparation changes')
            return
        }

        console.log(`📥 Received ${data.length} device preparation updates`)

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
                        rec.modifiedBy = row.modified_by;
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
                        rec.modifiedBy = row.modified_by;
                        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime()
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                }
            }

            // Update timestamp
            const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
            await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())
        })

        console.log('✅ Device preparation sync complete')
    }

    /**
     * Sync deployments (incremental pull)
     */
    private async syncDeployments(): Promise<void> {
        const LAST_PULLED_KEY = SYNC_STATE_KEYS.DEPLOYMENTS_LAST_PULLED_AT
        const lastPulledStr = await SyncStateService.get(LAST_PULLED_KEY)
        const lastPulledAt = lastPulledStr ? new Date(parseInt(lastPulledStr, 10)).toISOString() : new Date(0).toISOString()

        console.log('⛺ Syncing deployments since', lastPulledAt)

        const client = getSupabaseClient()
        const { data, error } = await client
            .from('deployments')
            .select('*')
            .gt('updated_at', lastPulledAt)

        if (error) {
            console.error('❌ Failed to sync deployments:', error)
            return
        }

        if (!data || data.length === 0) {
            console.log('✅ No new deployment changes')
            return
        }

        console.log(`📥 Received ${data.length} deployment updates`)

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

                        rec.deploymentStart = row.deployment_start ? new Date(row.deployment_start) : new Date()
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

        console.log('✅ Deployments sync complete')
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
                    console.log('📡 Realtime change received:', payload.table, payload.eventType)
                    // Use debounced sync to avoid thrashing
                    this.debouncedSync()
                }
            )
            .subscribe()

        console.log('📡 Realtime subscription started (debounced)')
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

        console.log('📡 Realtime subscription stopped')
    }
}

export default new SupabaseSyncService()
