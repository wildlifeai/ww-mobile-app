import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class UserRole extends Model {
    static table = 'user_roles'

    @field('user_id') userId!: string
    @field('role') role!: 'ww_admin' | 'project_admin' | 'project_member'
    @field('scope_type') scopeType!: 'global' | 'organisation' | 'project'
    @field('scope_id') scopeId?: string
    @field('granted_by') grantedBy!: string
    @date('granted_at') grantedAt!: Date
    @date('expires_at') expiresAt?: Date
    @field('is_active') isActive!: boolean
    @field('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt?: Date

    // Sync tracking fields
    @field('_version') version!: number
    @field('_custom_sync_status') customSyncStatus?: string
}
