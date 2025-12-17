import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class SyncState extends Model {
    static table = 'sync_state'

    @field('key') key!: string
    @text('value') value!: string // JSON serialized state

    @readonly @date('updated_at') updatedAt!: number
}
