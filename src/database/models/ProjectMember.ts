import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'
import Project from './Project'

export default class ProjectMember extends Model {
    static table = 'project_members'

    static associations = {
        projects: { type: 'belongs_to', key: 'project_id' },
    } as const

    @field('project_id') projectId!: string
    @field('user_id') userId!: string
    @field('role') role!: string

    @relation('projects', 'project_id') project!: Project

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt?: Date

    // Sync tracking fields
    @field('_version') version!: number
    @field('_custom_sync_status') customSyncStatus?: string
}
