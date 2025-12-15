import { Model } from '@nozbe/watermelondb'
import { field, text, date, relation, readonly, json } from '@nozbe/watermelondb/decorators'

export default class Deployment extends Model {
    static table = 'deployments'
    static associations = {
        projects: { type: 'belongs_to', key: 'project_id' },
    } as const

    @field('project_id') projectId!: string
    @field('device_id') deviceId!: string // Legacy? or derived?
    @field('device_preparation_id') devicePreparationId!: string

    @field('deployment_status_id') deploymentStatusId?: number
    @field('capture_method_id') captureMethodId?: number
    @field('activity_detection_sensitivity_id') activityDetectionSensitivityId?: number
    @field('timelapse_interval_seconds') timelapseIntervalSeconds?: number

    @text('name') name?: string
    @field('setup_by') setupBy!: string
    @field('ended_by') endedBy?: string

    // Location
    @text('location_name') locationName!: string
    @json('location', (raw: any) => raw) location: any
    @field('latitude') latitude?: number
    @field('longitude') longitude?: number
    @json('camera_location_image_paths', (raw: any) => raw) cameraLocationImagePaths: any
    @field('camera_height') cameraHeight?: number

    // Lifecycle
    @date('deployment_start') deploymentStart!: number
    @date('deployment_end') deploymentEnd!: number

    // Comments
    @text('start_deployment_comments') startDeploymentComments?: string
    @text('end_deployment_comments') endDeploymentComments?: string

    // Legacy fields - kept to avoid breakages if used elsewhere, but marked
    @text('deployment_comments') deploymentComments?: string
    @text('camera_location_description') cameraLocationDescription?: string
    @text('camera_location_image_path') cameraLocationImagePath?: string
    @json('deployment_photos', (raw: any) => raw) deploymentPhotos: any

    @field('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number

    @relation('projects', 'project_id') project: any
    @relation('users', 'user_id') user: any
}
