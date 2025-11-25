import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import database from '../database'
import SyncOutbox from '../database/models/SyncOutbox'
import SyncStateService from './SyncStateService'

/**
 * OutboxService
 * 
 * Manages the sync outbox for tracking offline operations.
 * 
 * Key responsibilities:
 * - Record all CRUD operations for sync
 * - Generate operation IDs for idempotency
 * - Use Lamport clock for operation ordering
 * - Track operation status (pending, syncing, synced, failed)
 * - Support retry logic for failed operations
 */

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE'
export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

interface RecordOperationParams {
    operation: OperationType
    tableName: string
    recordId: string
    payload: any
    version?: number
    userId?: string
    deviceId?: string
}

class OutboxService {
    /**
     * Record a CRUD operation in the outbox
     * 
     * This is called after every local database mutation to track
     * the change for eventual sync to the server.
     */
    async recordOperation(params: RecordOperationParams): Promise<string> {
        const {
            operation,
            tableName,
            recordId,
            payload,
            version = 0,
            userId,
            deviceId,
        } = params

        try {
            // Generate unique operation ID for idempotency
            const operationId = uuidv4()

            // Get next Lamport clock for ordering
            const lamportClock = await SyncStateService.getNextLamportClock()

            await database.write(async () => {
                await database.get<SyncOutbox>('sync_outbox').create(op => {
                    op.operationId = operationId
                    op.operationType = operation
                    op.tableName = tableName
                    op.recordId = recordId
                    op.payload = JSON.stringify(payload)
                    op.version = version
                    op.lamportClock = lamportClock
                    op.retryCount = 0
                    op.status = 'pending'
                    op.userId = userId
                    op.deviceId = deviceId
                })
            })

            console.log(`📦 Recorded ${operation} operation for ${tableName}:${recordId} (clock: ${lamportClock})`)
            return operationId
        } catch (error) {
            console.error('[OutboxService] Error recording operation:', error)
            throw error
        }
    }

    /**
     * Get all pending operations (ordered by Lamport clock)
     */
    async getPendingOperations(): Promise<SyncOutbox[]> {
        try {
            const operations = await database.get<SyncOutbox>('sync_outbox')
                .query(
                    Q.where('status', 'pending'),
                    Q.sortBy('lamport_clock', Q.asc)
                )
                .fetch()

            return operations
        } catch (error) {
            console.error('[OutboxService] Error getting pending operations:', error)
            return []
        }
    }

    /**
     * Get pending operations for a specific table
     */
    async getPendingOperationsForTable(tableName: string): Promise<SyncOutbox[]> {
        try {
            const operations = await database.get<SyncOutbox>('sync_outbox')
                .query(
                    Q.where('table_name', tableName),
                    Q.where('status', 'pending'),
                    Q.sortBy('lamport_clock', Q.asc)
                )
                .fetch()

            return operations
        } catch (error) {
            console.error(`[OutboxService] Error getting pending operations for ${tableName}:`, error)
            return []
        }
    }

    /**
     * Get pending operations for a specific record
     */
    async getPendingOperationsForRecord(tableName: string, recordId: string): Promise<SyncOutbox[]> {
        try {
            const operations = await database.get<SyncOutbox>('sync_outbox')
                .query(
                    Q.where('table_name', tableName),
                    Q.where('record_id', recordId),
                    Q.where('status', 'pending'),
                    Q.sortBy('lamport_clock', Q.asc)
                )
                .fetch()

            return operations
        } catch (error) {
            console.error(`[OutboxService] Error getting pending operations for ${tableName}:${recordId}:`, error)
            return []
        }
    }

    /**
     * Check if a record has pending operations
     */
    async hasPendingOperations(tableName: string, recordId: string): Promise<boolean> {
        const ops = await this.getPendingOperationsForRecord(tableName, recordId)
        return ops.length > 0
    }

    /**
     * Mark operations as syncing
     * Called when sync starts to prevent duplicate processing
     */
    async markAsSyncing(operationIds: string[]): Promise<void> {
        try {
            await database.write(async () => {
                for (const opId of operationIds) {
                    const operations = await database.get<SyncOutbox>('sync_outbox')
                        .query(Q.where('operation_id', opId))
                        .fetch()

                    for (const op of operations) {
                        await op.update(o => {
                            o.status = 'syncing'
                        })
                    }
                }
            })
        } catch (error) {
            console.error('[OutboxService] Error marking operations as syncing:', error)
        }
    }

    /**
     * Mark operations as synced
     * Called after successful push to server
     */
    async markAsSynced(operationIds: string[]): Promise<void> {
        try {
            await database.write(async () => {
                for (const opId of operationIds) {
                    const operations = await database.get<SyncOutbox>('sync_outbox')
                        .query(Q.where('operation_id', opId))
                        .fetch()

                    for (const op of operations) {
                        await op.update(o => {
                            o.status = 'synced'
                        })
                    }
                }
            })

            console.log(`✅ Marked ${operationIds.length} operations as synced`)
        } catch (error) {
            console.error('[OutboxService] Error marking operations as synced:', error)
        }
    }

    /**
     * Mark operation as failed
     * Increments retry count and stores error message
     */
    async markAsFailed(operationId: string, errorMessage: string): Promise<void> {
        try {
            await database.write(async () => {
                const operations = await database.get<SyncOutbox>('sync_outbox')
                    .query(Q.where('operation_id', operationId))
                    .fetch()

                for (const op of operations) {
                    await op.update(o => {
                        o.status = 'failed'
                        o.retryCount = op.retryCount + 1
                        o.errorMessage = errorMessage
                    })
                }
            })

            console.warn(`⚠️ Marked operation ${operationId} as failed: ${errorMessage}`)
        } catch (error) {
            console.error('[OutboxService] Error marking operation as failed:', error)
        }
    }

    /**
     * Mark operation as conflict
     * Called when server detects version mismatch
     */
    async markAsConflict(operationId: string): Promise<void> {
        try {
            await database.write(async () => {
                const operations = await database.get<SyncOutbox>('sync_outbox')
                    .query(Q.where('operation_id', operationId))
                    .fetch()

                for (const op of operations) {
                    await op.update(o => {
                        o.status = 'conflict'
                    })
                }
            })

            console.warn(`⚠️ Marked operation ${operationId} as conflict`)
        } catch (error) {
            console.error('[OutboxService] Error marking operation as conflict:', error)
        }
    }

    /**
     * Reset failed operation to pending for retry
     */
    async retryFailedOperation(operationId: string): Promise<void> {
        try {
            await database.write(async () => {
                const operations = await database.get<SyncOutbox>('sync_outbox')
                    .query(Q.where('operation_id', operationId))
                    .fetch()

                for (const op of operations) {
                    await op.update(o => {
                        o.status = 'pending'
                        o.errorMessage = undefined
                    })
                }
            })

            console.log(`🔄 Reset operation ${operationId} to pending for retry`)
        } catch (error) {
            console.error('[OutboxService] Error retrying operation:', error)
        }
    }

    /**
     * Get all failed operations
     */
    async getFailedOperations(): Promise<SyncOutbox[]> {
        try {
            return await database.get<SyncOutbox>('sync_outbox')
                .query(Q.where('status', 'failed'))
                .fetch()
        } catch (error) {
            console.error('[OutboxService] Error getting failed operations:', error)
            return []
        }
    }

    /**
     * Get all conflict operations
     */
    async getConflictOperations(): Promise<SyncOutbox[]> {
        try {
            return await database.get<SyncOutbox>('sync_outbox')
                .query(Q.where('status', 'conflict'))
                .fetch()
        } catch (error) {
            console.error('[OutboxService] Error getting conflict operations:', error)
            return []
        }
    }

    /**
     * Clean up synced operations older than specified days
     * Keeps database size manageable
     */
    async cleanupSyncedOperations(olderThanDays: number = 7): Promise<number> {
        try {
            const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)

            const syncedOps = await database.get<SyncOutbox>('sync_outbox')
                .query(
                    Q.where('status', 'synced'),
                    Q.where('created_at', Q.lt(cutoffTime))
                )
                .fetch()

            await database.write(async () => {
                for (const op of syncedOps) {
                    await op.markAsDeleted()
                }
            })

            console.log(`🧹 Cleaned up ${syncedOps.length} synced operations older than ${olderThanDays} days`)
            return syncedOps.length
        } catch (error) {
            console.error('[OutboxService] Error cleaning up synced operations:', error)
            return 0
        }
    }

    /**
     * Get outbox statistics for monitoring
     */
    async getStatistics(): Promise<{
        pending: number
        syncing: number
        synced: number
        failed: number
        conflict: number
        total: number
    }> {
        try {
            const all = await database.get<SyncOutbox>('sync_outbox').query().fetch()

            const stats = {
                pending: all.filter(op => op.status === 'pending').length,
                syncing: all.filter(op => op.status === 'syncing').length,
                synced: all.filter(op => op.status === 'synced').length,
                failed: all.filter(op => op.status === 'failed').length,
                conflict: all.filter(op => op.status === 'conflict').length,
                total: all.length,
            }

            return stats
        } catch (error) {
            console.error('[OutboxService] Error getting statistics:', error)
            return {
                pending: 0,
                syncing: 0,
                synced: 0,
                failed: 0,
                conflict: 0,
                total: 0,
            }
        }
    }

    /**
     * Delete a specific operation (use with caution!)
     */
    async deleteOperation(operationId: string): Promise<void> {
        try {
            await database.write(async () => {
                const operations = await database.get<SyncOutbox>('sync_outbox')
                    .query(Q.where('operation_id', operationId))
                    .fetch()

                for (const op of operations) {
                    await op.markAsDeleted()
                }
            })

            console.log(`🗑️ Deleted operation ${operationId}`)
        } catch (error) {
            console.error('[OutboxService] Error deleting operation:', error)
        }
    }

    /**
     * Clear all operations (DANGEROUS - use only for testing/reset)
     */
    async clearAll(): Promise<void> {
        try {
            await database.write(async () => {
                const all = await database.get<SyncOutbox>('sync_outbox').query().fetch()
                for (const op of all) {
                    await op.markAsDeleted()
                }
            })

            console.warn('⚠️🗑️ Cleared all outbox operations')
        } catch (error) {
            console.error('[OutboxService] Error clearing all operations:', error)
        }
    }
}

export default new OutboxService()
