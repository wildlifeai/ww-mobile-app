import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class AiModel extends Model {
    static table = 'ai_models'

    @field('server_id') serverId!: string // UUID from Supabase
    @field('name') name!: string
    @field('version') version!: string
    @field('description') description?: string
    @field('organisation_id') organisationId!: string
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
