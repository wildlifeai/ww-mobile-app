import { synchronize } from '@nozbe/watermelondb/sync'
import { RealtimeChannel } from '@supabase/supabase-js'
import database from '../database'
import { getSupabaseClient } from './supabase'

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

                    const { data, error } = await (client as any).rpc('pull_changes', {
                        last_pulled_at: lastPulledAt ?? 0
                    })

                    if (error) {
                        console.error('Pull changes failed:', error)
                        throw error
                    }

                    // RPC returns { changes: ..., timestamp: ... }
                    const { changes, timestamp } = data as any

                    return { changes, timestamp }
                },
                pushChanges: async ({ changes, lastPulledAt }) => {
                    console.log('Pushing changes')
                    const client = getSupabaseClient()

                    const { error } = await (client as any).rpc('push_changes', {
                        changes
                    })

                    if (error) {
                        console.error('Push changes failed:', error)
                        throw error
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

        // Listen to changes on the 'projects' and 'deployments' tables
        // We can use a wildcard for the schema to catch all changes
        this.realtimeChannel = client
            .channel('public:db_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    console.log('Realtime change received:', payload)
                    // Debounce sync to avoid flooding
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
