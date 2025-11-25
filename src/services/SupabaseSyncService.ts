import { synchronize } from '@nozbe/watermelondb/sync'
import { Q } from '@nozbe/watermelondb'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'
import SyncOutbox from '../database/models/SyncOutbox'
import SyncStateService from './SyncStateService'

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
        await SyncStateService.setSyncInProgress(true)
        const syncStartTime = Date.now()

        try {
            await synchronize({
                database,
                pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
                    console.log('🔽 Pulling changes since', lastPulledAt)
                    const client = getSupabaseClient()

                    const { data, error } = await (client as any).rpc('pull_changes', {
                        last_pulled_at: lastPulledAt ?? 0
                    })

                    if (error) {
                        console.error('❌ Pull changes failed:', error)
                        throw error
                    }

                    // RPC returns { changes: ..., conflicts: ..., timestamp: ... }
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
                    const pendingRecordIds = new Set<string>()
                    const pendingByTable: Record<string, Set<string>> = {
                        projects: new Set(),
                        deployments: new Set(),
                    }

                    for (const op of pendingOps) {
                        pendingRecordIds.add(op.recordId)
                        if (pendingByTable[op.tableName]) {
                            pendingByTable[op.tableName].add(op.recordId)
                        }
                    }

                    console.log(`📦 Found ${pendingRecordIds.size} pending operations in outbox:`)
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

                    return { changes: safeChanges, timestamp }
                },
                pushChanges: async ({ changes, lastPulledAt }) => {
                    console.log('🔼 Pushing changes')
                    const client = getSupabaseClient()

                    const { data, error } = await (client as any).rpc('push_changes', {
                        changes
                    })

                    if (error) {
                        console.error('❌ Push changes failed:', error)
                        throw error
                    }

                    // Handle push response with conflict info
                    if (data && data.conflicts > 0) {
                        console.warn(`⚠️ ${data.conflicts} conflicts detected during push:`, data.conflict_details)
                        // TODO: Store conflicts for user resolution
                    }

                    if (data) {
                        console.log(`✅ Pushed ${data.processed} changes successfully`)
                    }
                },
                // migrationsEnabledAtVersion: 1,
            })

            // Sync succeeded
            const syncEndTime = Date.now()
            const syncDuration = syncEndTime - syncStartTime

            await SyncStateService.setLastSyncedAt(syncEndTime)
            await SyncStateService.clearLastSyncError()
            const syncCount = await SyncStateService.incrementSyncCount()

            console.log(`✅ Sync completed successfully in ${syncDuration}ms (total syncs: ${syncCount})`)
        } catch (error) {
            console.error('❌ Sync failed:', error)

            // Log error to sync state
            const errorMessage = error instanceof Error ? error.message : String(error)
            await SyncStateService.setLastSyncError(errorMessage)

            // Re-throw for debugging
            throw error
        } finally {
            this.isSyncing = false
            await SyncStateService.setSyncInProgress(false)
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
