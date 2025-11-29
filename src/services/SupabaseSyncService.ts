import { Q } from '@nozbe/watermelondb'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'
import SyncOutbox from '../database/models/SyncOutbox'
import SyncStateService, { SYNC_STATE_KEYS } from './SyncStateService'
import { Database } from '../types/database.types'
import UserRole from '../database/models/UserRole'
import Device from '../database/models/Device'

class SupabaseSyncService {
    private realtimeChannel: RealtimeChannel | null = null
    private isSyncing = false
    private syncDebounceTimer: NodeJS.Timeout | null = null
    private readonly SYNC_DEBOUNCE_MS = 2000 // 2 seconds

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

        this.isSyncing = true
        await database.write(async () => {
            await SyncStateService.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, 'true')
        })
        const syncStartTime = Date.now()

        try {
            // ================================================================
            // STEP 1: UPLOAD OUTBOX OPERATIONS
            // ================================================================
            await this.uploadOutbox()

            // ================================================================
            // STEP 2: PULL REMOTE CHANGES
            // ================================================================
            await this.pullRemoteChanges()
            await this.syncUserRoles()
            await this.syncDevices()

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
    private async uploadOutbox(): Promise<void> {
        const pendingOps = await database.get<SyncOutbox>('sync_outbox')
            .query(Q.where('status', 'pending'))
            .fetch()

        if (pendingOps.length === 0) {
            console.log('✅ Sync complete - no pending operations')
            return
        }

        console.log(`📤 Uploading ${pendingOps.length} pending operations...`)

        // Mark operations as syncing
        const operationIds = pendingOps.map(op => op.operationId)
        await database.write(async () => {
            for (const op of pendingOps) {
                await op.update(o => {
                    o.status = 'syncing'
                })
            }
        })

        // Group operations by table and operation type
        const changes: any = {
            projects: { created: [], updated: [], deleted: [] },
            deployments: { created: [], updated: [], deleted: [] },
        }

        for (const op of pendingOps) {
            const payload = JSON.parse(op.payload)

            // Add operation_id to payload for server-side idempotency
            payload.operation_id = op.operationId

            const tableName = op.tableName
            const operationType = op.operationType.toLowerCase()

            if (changes[tableName]) {
                if (operationType === 'create') {
                    changes[tableName].created.push(payload)
                } else if (operationType === 'update') {
                    changes[tableName].updated.push(payload)
                } else if (operationType === 'delete') {
                    changes[tableName].deleted.push(payload.id)
                }
            }
        }

        console.log('📦 Changes to upload:', {
            projects: {
                created: changes.projects.created.length,
                updated: changes.projects.updated.length,
                deleted: changes.projects.deleted.length,
            },
            deployments: {
                created: changes.deployments.created.length,
                updated: changes.deployments.updated.length,
                deleted: changes.deployments.deleted.length,
            },
        })

        // Push to server
        const client = getSupabaseClient()
        const { data, error } = await (client as any).rpc('push_changes', { changes })

        if (error) {
            console.error('❌ Push failed:', error)

            // Mark operations as failed
            await database.write(async () => {
                for (const op of pendingOps) {
                    await op.update(o => {
                        o.status = 'failed'
                        o.errorMessage = error.message
                        o.retryCount = op.retryCount + 1
                    })
                }
            })

            throw error
        }

        console.log(`✅ Server processed ${data.processed} operations`)

        // Handle conflicts
        if (data.conflicts > 0) {
            console.warn(`⚠️ ${data.conflicts} conflicts detected:`, data.conflict_details)

            await database.write(async () => {
                for (const conflict of data.conflict_details) {
                    const conflictOp = pendingOps.find(op => op.operationId === conflict.operation_id)
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
            for (const op of pendingOps) {
                if (!conflictOpIds.has(op.operationId)) {
                    await op.update(o => {
                        o.status = 'synced'
                    })
                }
            }
        })

        console.log(`✅ Marked ${pendingOps.length - conflictOpIds.size} operations as synced`)
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
            deployments: new Set(),
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
        }

        // Log filtering stats
        const totalFiltered =
            (rawChanges.projects?.created?.length || 0) - (safeChanges.projects.created.length) +
            (rawChanges.projects?.updated?.length || 0) - (safeChanges.projects.updated.length) +
            (rawChanges.projects?.deleted?.length || 0) - (safeChanges.projects.deleted.length) +
            (rawChanges.deployments?.created?.length || 0) - (safeChanges.deployments.created.length) +
            (rawChanges.deployments?.updated?.length || 0) - (safeChanges.deployments.updated.length) +
            (rawChanges.deployments?.deleted?.length || 0) - (safeChanges.deployments.deleted.length)

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
                        rec.modifiedBy = row.modified_by
                        rec.createdAt = new Date(row.created_at ?? Date.now())
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                }
            }
        })

        // Update timestamp
        const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
        await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())

        console.log('✅ User roles sync complete')
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
                // Check if exists
                try {
                    const existing = await collection.find(row.id)
                    await existing.update((rec) => {
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.batteryLevel = row.battery_level ?? 0
                        rec.organisationId = row.organisation_id ?? ''
                        rec.firmwareId = row.config_firmware_id ?? row.ble_firmware_id ?? ''
                        rec.lastBatteryCheck = row.last_battery_check ?? ''
                        rec.lastSdCardCheck = row.last_sd_card_check ?? ''
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                } catch (e) {
                    // Not found, create
                    await collection.create((rec) => {
                        rec._raw.id = row.id // Use server ID
                        rec.bluetoothId = row.bluetooth_id
                        rec.name = row.name
                        rec.batteryLevel = row.battery_level ?? 0
                        rec.organisationId = row.organisation_id ?? ''
                        rec.firmwareId = row.config_firmware_id ?? row.ble_firmware_id ?? ''
                        rec.lastBatteryCheck = row.last_battery_check ?? ''
                        rec.lastSdCardCheck = row.last_sd_card_check ?? ''
                        rec.createdAt = new Date(row.created_at ?? Date.now())
                        rec.updatedAt = new Date(row.updated_at ?? Date.now())
                    })
                }
            }
        })

        // Update timestamp
        const maxTimestamp = Math.max(...data.map((d: any) => new Date(d.updated_at).getTime()))
        await SyncStateService.set(LAST_PULLED_KEY, maxTimestamp.toString())

        console.log('✅ Devices sync complete')
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
