import { Model } from '@nozbe/watermelondb'
import { text, date, field, readonly } from '@nozbe/watermelondb/decorators'

export default class Organisation extends Model {
    static table = 'organisations'

    @text('name') name!: string
    @text('slug') slug!: string
    @text('created_by') createdBy?: string
    @field('is_active') isActive!: boolean

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number
}
