import { Model } from '@nozbe/watermelondb'
import { field, text, date, relation, readonly, json } from '@nozbe/watermelondb/decorators'

export default class Deployment extends Model {
    static table = 'deployments'
    static associations = {
        projects: { type: 'belongs_to', key: 'project_id' },
        users: { type: 'belongs_to', key: 'user_id' },
    } as const

    @field('project_id') projectId!: string
    @field('user_id') userId!: string
    @field('device_id') deviceId!: string
    @field('deployment_status_id') deploymentStatusId?: number
    @field('capture_method_id') captureMethodId?: number
    @text('name') name?: string
    @text('location_name') locationName!: string
    @json('location', (raw: any) => raw) location: any
    @field('latitude') latitude?: number
    @field('longitude') longitude?: number
    @date('deployment_start') deploymentStart!: number
    @date('deployment_end') deploymentEnd!: number
    @text('deployment_comments') deploymentComments?: string
    @text('camera_location_description') cameraLocationDescription?: string
    @text('camera_location_image_path') cameraLocationImagePath?: string
    @json('deployment_photos', (raw: any) => raw) deploymentPhotos: any

    @readonly @date('created_at') createdAt!: number
    @readonly @date('updated_at') updatedAt!: number
    @readonly @date('deleted_at') deletedAt!: number

    @relation('projects', 'project_id') project: any
    @relation('users', 'user_id') user: any
}
