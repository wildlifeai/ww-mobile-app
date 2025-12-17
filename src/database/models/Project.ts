import { Model } from '@nozbe/watermelondb'
import { field, text, date, children, readonly } from '@nozbe/watermelondb/decorators'

export default class Project extends Model {
    static table = 'projects'
    static associations = {
        deployments: { type: 'has_many', foreignKey: 'project_id' },
    } as const

    @field('organisation_id') organisationId!: string
    @text('name') name!: string
    @text('description') description?: string | null
    @field('is_active') isActive!: boolean
    @field('sampling_design_id') samplingDesignId?: number | null
    @field('activity_detection_sensitivity_id') activityDetectionSensitivityId?: number | null
    @field('capture_method_id') captureMethodId?: number | null
    @field('model_id') modelId?: string | null
    @field('is_baited') isBaited?: boolean
    @field('is_monitoring_marked_individuals') isMonitoringMarkedIndividuals?: boolean
    @field('timelapse_interval_seconds') timelapseIntervalSeconds?: number | null
    @text('project_image') projectImage?: string | null
    @text('website') website?: string | null
    @text('created_by') createdBy?: string
    @text('modified_by') modifiedBy!: string

    @field('_version') version!: number
    @text('_custom_sync_status') customSyncStatus?: string

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number

    @children('deployments') deployments: any
}
