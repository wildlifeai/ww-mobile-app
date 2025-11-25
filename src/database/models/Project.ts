import { Model } from '@nozbe/watermelondb'
import { field, text, date, children, readonly } from '@nozbe/watermelondb/decorators'

export default class Project extends Model {
    static table = 'projects'
    static associations = {
        deployments: { type: 'has_many', foreignKey: 'project_id' },
    } as const

    @field('organisation_id') organisationId!: string
    @text('name') name!: string
    @text('description') description?: string
    @field('is_active') isActive!: boolean
    @field('sampling_design_id') samplingDesignId?: number
    @field('activity_detection_sensitivity_id') activityDetectionSensitivityId?: number
    @field('capture_method_id') captureMethodId?: number
    @field('model_id') modelId?: string
    @field('is_baited') isBaited?: boolean
    @field('is_monitoring_marked_individuals') isMonitoringMarkedIndividuals?: boolean
    @field('timelapse_interval_seconds') timelapseIntervalSeconds?: number
    @text('project_image') projectImage?: string
    @text('website') website?: string
    @text('created_by') createdBy?: string
    @text('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number

    // Sync tracking fields
    @field('_version') version!: number
    @field('_custom_sync_status') customSyncStatus?: string

    @children('deployments') deployments: any
}
