import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class SyncOutbox extends Model {
    static table = 'sync_outbox'

    @field('operation_id') operationId!: string
    @field('operation_type') operationType!: string // CREATE/UPDATE/DELETE
    @field('table_name') tableName!: string
    @field('record_id') recordId!: string
    @text('payload') payload!: string // JSON serialized change
    @field('version') version!: number
    @field('lamport_clock') lamportClock!: number
    @field('retry_count') retryCount!: number
    @field('status') status!: string // pending/syncing/synced/failed/conflict
    @text('error_message') errorMessage?: string
    @field('user_id') userId?: string
    @field('device_id') deviceId?: string

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
}
