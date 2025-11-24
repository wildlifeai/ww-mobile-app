import { synchronize } from '@nozbe/watermelondb/sync'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'

// Define the tables we are syncing
type TableName = 'projects' | 'deployments' | 'users'
const SYNC_TABLES: TableName[] = ['projects', 'deployments', 'users']

class SupabaseSyncService {
    private realtimeChannel: RealtimeChannel | null = null
    private isSyncing = false

    async sync() {
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping.')
            return
        }

        this.isSyncing = true
        try {
            await synchronize({
                database,
                pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
                    console.log('Pulling changes since', lastPulledAt)
                    const client = getSupabaseClient()
                    const timestamp = Date.now()

                    const changes: any = {}

                    for (const table of SYNC_TABLES) {
                        const lastPulledIso = lastPulledAt ? new Date(lastPulledAt).toISOString() : new Date(0).toISOString()

                        // Explicitly cast table to string to satisfy Supabase client overload if needed
                        const { data: remoteChanges, error } = await client
                            .from(table)
                            .select('*')
                            .gt('updated_at', lastPulledIso)

                        if (error) throw error

                        const created = []
                        const updated = []
                        const deleted = []

                        for (const record of remoteChanges || []) {
                            const typedRecord = record as any
                            if (typedRecord.deleted_at) {
                                deleted.push(typedRecord.id)
                            } else if (lastPulledAt && new Date(typedRecord.created_at).getTime() > lastPulledAt) {
                                created.push(typedRecord)
                            } else {
                                updated.push(typedRecord)
                            }
                        }

                        changes[table] = { created, updated, deleted }
                    }

                    return { changes, timestamp }
                },
                pushChanges: async ({ changes, lastPulledAt }) => {
                    console.log('Pushing changes')
                    const client = getSupabaseClient()

                    for (const table of SYNC_TABLES) {
                        const tableChanges = (changes as any)[table]
                        if (!tableChanges) continue

                        const { created, updated, deleted } = tableChanges

                        // Bulk Insert
                        if (created.length > 0) {
                            const { error } = await client.from(table).insert(created)
                            if (error) throw error
                        }

                        // Bulk Update (Upsert)
                        if (updated.length > 0) {
                            const { error } = await client.from(table).upsert(updated)
                            if (error) throw error
                        }

                        // Bulk Delete (Soft Delete)
                        if (deleted.length > 0) {
                            const now = new Date().toISOString()
                            const updates = deleted.map((id: string) => ({ id, deleted_at: now }))
                            const { error } = await client.from(table).upsert(updates as any)
                            if (error) throw error
                        }
                    }
                },
                // migrationsEnabledAtVersion: 1,
            })
        } catch (error) {
            console.error('Sync failed:', error)
        } finally {
            this.isSyncing = false
        }
    }

    async startRealtimeSubscription() {
        const client = getSupabaseClient()

        if (this.realtimeChannel) {
            return
        }

        this.realtimeChannel = client
            .channel('public:db_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    console.log('Realtime change received:', payload)
                    this.sync()
                }
            )
            .subscribe()
    }

    async stopRealtimeSubscription() {
        if (this.realtimeChannel) {
            await this.realtimeChannel.unsubscribe()
            this.realtimeChannel = null
        }
    }
}

export default new SupabaseSyncService()
