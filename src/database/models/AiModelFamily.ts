import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class AiModelFamily extends Model {
    static table = 'ai_model_families'

    @field('name') name!: string
    @field('description') description?: string
    @field('firmware_model_id') firmwareModelId!: number
    @field('organisation_id') organisationId!: string
    @field('created_by') createdBy?: string

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
