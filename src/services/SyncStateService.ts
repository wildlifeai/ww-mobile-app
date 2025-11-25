import AsyncStorage from '@react-native-async-storage/async-storage'
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import SyncState from '../database/models/SyncState'

/**
 * SyncStateService
 * 
 * Manages sync metadata using dual storage:
 * - AsyncStorage: Fast, synchronous-like access
 * - Database: Queryable, persistent backup
 * 
 * Best practice: Always update both stores for consistency
 */

// Predefined sync state keys
export const SYNC_STATE_KEYS = {
    LAST_SYNCED_AT: 'last_synced_at',
    LAST_PULL_TIMESTAMP: 'last_pull_timestamp',
    LAST_PUSH_TIMESTAMP: 'last_push_timestamp',
    SYNC_IN_PROGRESS: 'sync_in_progress',
    LAST_SYNC_ERROR: 'last_sync_error',
    TOTAL_SYNCS: 'total_syncs',
    LAMPORT_CLOCK: 'lamport_clock',
} as const

type SyncStateKey = typeof SYNC_STATE_KEYS[keyof typeof SYNC_STATE_KEYS]

class SyncStateService {
    private readonly STORAGE_PREFIX = '@wildlifewatcher:sync:'

    /**
     * Get a sync state value
     * 
     * Strategy:
     * 1. Try AsyncStorage first (fastest)
     * 2. Fallback to database if not in cache
     * 3. Return null if not found anywhere
     */
    async get(key: SyncStateKey): Promise<string | null> {
        try {
            // Try AsyncStorage first
            const cached = await AsyncStorage.getItem(this.getStorageKey(key))
            if (cached !== null) {
                return cached
            }

            // Fallback to database
            const records = await database.get<SyncState>('sync_state')
                .query(Q.where('key', key))
                .fetch()

            if (records.length > 0) {
                const value = records[0].value
                // Populate AsyncStorage cache
                await AsyncStorage.setItem(this.getStorageKey(key), value)
                return value
            }

            return null
        } catch (error) {
            console.error(`[SyncStateService] Error getting key ${key}:`, error)
            return null
        }
    }

    /**
     * Set a sync state value
     * 
     * Updates both AsyncStorage and database atomically
     */
    async set(key: SyncStateKey, value: string): Promise<void> {
        try {
            // Update database first (source of truth)
            await database.write(async () => {
                const existing = await database.get<SyncState>('sync_state')
                    .query(Q.where('key', key))
                    .fetch()

                if (existing.length > 0) {
                    await existing[0].update(state => {
                        state.value = value
                    })
                } else {
                    await database.get<SyncState>('sync_state').create(state => {
                        state.key = key
                        state.value = value
                    })
                }
            })

            // Update AsyncStorage cache
            await AsyncStorage.setItem(this.getStorageKey(key), value)
        } catch (error) {
            console.error(`[SyncStateService] Error setting key ${key}:`, error)
            throw error
        }
    }

    /**
     * Delete a sync state value
     */
    async delete(key: SyncStateKey): Promise<void> {
        try {
            // Remove from database
            await database.write(async () => {
                const records = await database.get<SyncState>('sync_state')
                    .query(Q.where('key', key))
                    .fetch()

                for (const record of records) {
                    await record.markAsDeleted()
                }
            })

            // Remove from AsyncStorage
            await AsyncStorage.removeItem(this.getStorageKey(key))
        } catch (error) {
            console.error(`[SyncStateService] Error deleting key ${key}:`, error)
            throw error
        }
    }

    // ===========================================================================
    // Convenience Methods for Common Operations
    // ===========================================================================

    /**
     * Get last synced timestamp (milliseconds)
     */
    async getLastSyncedAt(): Promise<number> {
        const value = await this.get(SYNC_STATE_KEYS.LAST_SYNCED_AT)
        return value ? parseInt(value, 10) : 0
    }

    /**
     * Set last synced timestamp (milliseconds)
     */
    async setLastSyncedAt(timestamp: number): Promise<void> {
        await this.set(SYNC_STATE_KEYS.LAST_SYNCED_AT, timestamp.toString())
    }

    /**
     * Get last pull timestamp from server
     */
    async getLastPullTimestamp(): Promise<number> {
        const value = await this.get(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)
        return value ? parseInt(value, 10) : 0
    }

    /**
     * Set last pull timestamp from server
     */
    async setLastPullTimestamp(timestamp: number): Promise<void> {
        await this.set(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP, timestamp.toString())
    }

    /**
     * Check if sync is currently in progress
     */
    async isSyncInProgress(): Promise<boolean> {
        const value = await this.get(SYNC_STATE_KEYS.SYNC_IN_PROGRESS)
        return value === 'true'
    }

    /**
     * Set sync in progress flag
     */
    async setSyncInProgress(inProgress: boolean): Promise<void> {
        await this.set(SYNC_STATE_KEYS.SYNC_IN_PROGRESS, inProgress.toString())
    }

    /**
     * Get last sync error (if any)
     */
    async getLastSyncError(): Promise<string | null> {
        return await this.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)
    }

    /**
     * Set last sync error
     */
    async setLastSyncError(error: string): Promise<void> {
        await this.set(SYNC_STATE_KEYS.LAST_SYNC_ERROR, error)
    }

    /**
     * Clear last sync error
     */
    async clearLastSyncError(): Promise<void> {
        await this.delete(SYNC_STATE_KEYS.LAST_SYNC_ERROR)
    }

    /**
     * Increment total sync counter
     */
    async incrementSyncCount(): Promise<number> {
        const current = await this.get(SYNC_STATE_KEYS.TOTAL_SYNCS)
        const count = current ? parseInt(current, 10) + 1 : 1
        await this.set(SYNC_STATE_KEYS.TOTAL_SYNCS, count.toString())
        return count
    }

    /**
     * Get total sync count
     */
    async getSyncCount(): Promise<number> {
        const value = await this.get(SYNC_STATE_KEYS.TOTAL_SYNCS)
        return value ? parseInt(value, 10) : 0
    }

    /**
     * Get and increment Lamport clock for operation ordering
     */
    async getNextLamportClock(): Promise<number> {
        const current = await this.get(SYNC_STATE_KEYS.LAMPORT_CLOCK)
        const clock = current ? parseInt(current, 10) + 1 : 1
        await this.set(SYNC_STATE_KEYS.LAMPORT_CLOCK, clock.toString())
        return clock
    }

    /**
     * Get all sync state for debugging
     */
    async getAllState(): Promise<Record<string, string>> {
        const allStates: Record<string, string> = {}

        try {
            const records = await database.get<SyncState>('sync_state').query().fetch()

            for (const record of records) {
                allStates[record.key] = record.value
            }
        } catch (error) {
            console.error('[SyncStateService] Error getting all state:', error)
        }

        return allStates
    }

    /**
     * Clear all sync state (use with caution!)
     */
    async clearAllState(): Promise<void> {
        try {
            // Clear database
            await database.write(async () => {
                const records = await database.get<SyncState>('sync_state').query().fetch()
                for (const record of records) {
                    await record.markAsDeleted()
                }
            })

            // Clear AsyncStorage
            const keys = Object.values(SYNC_STATE_KEYS)
            await AsyncStorage.multiRemove(keys.map(k => this.getStorageKey(k)))

            console.log('[SyncStateService] All sync state cleared')
        } catch (error) {
            console.error('[SyncStateService] Error clearing all state:', error)
            throw error
        }
    }

    // ===========================================================================
    // Private Helpers
    // ===========================================================================

    private getStorageKey(key: string): string {
        return `${this.STORAGE_PREFIX}${key}`
    }
}

export default new SyncStateService()
