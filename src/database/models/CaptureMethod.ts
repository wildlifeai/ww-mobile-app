import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class CaptureMethod extends Model {
    static table = 'capture_methods'

    @field('server_id') serverId!: number
    @field('value') value!: string
    @field('description') description!: string
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
