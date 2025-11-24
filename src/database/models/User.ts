import { Model } from '@nozbe/watermelondb'
import { text, date, readonly } from '@nozbe/watermelondb/decorators'

export default class User extends Model {
    static table = 'users'

    @text('firstname') firstname!: string
    @text('surname') surname!: string

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number
}
