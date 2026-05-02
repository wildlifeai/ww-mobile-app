import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class ActivitySensitivity extends Model {
    static table = 'activity_sensitivity'

    @field('server_id') serverId!: number
    @field('value') value!: string
    @field('description') description!: string
    @field('is_active') isActive!: boolean
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
