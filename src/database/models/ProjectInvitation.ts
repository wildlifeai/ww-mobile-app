import { Model } from '@nozbe/watermelondb'
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators'

export default class ProjectInvitation extends Model {
    static table = 'project_invitations'
    static associations = {
        projects: { type: 'belongs_to' as const, key: 'project_id' },
    }

    @field('remote_id') remoteId!: string
    @field('project_id') projectId!: string
    @field('inviter_id') inviterId!: string
    @field('invitee_email') inviteeEmail!: string
    @field('invitee_id') inviteeId?: string
    @field('role') role!: 'project_admin' | 'project_member'
    @field('status') status!: 'pending' | 'accepted' | 'declined' | 'expired'
    @date('expires_at') expiresAt!: Date
    @date('responded_at') respondedAt?: Date
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date

    @relation('projects', 'project_id') project: any
}
