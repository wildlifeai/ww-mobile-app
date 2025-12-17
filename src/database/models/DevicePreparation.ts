import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class DevicePreparation extends Model {
    static table = 'device_preparation'

    @field('device_id') deviceId!: string
    @field('project_id') projectId!: string
    @field('ai_model_id') aiModelId?: string
    @field('firmware_id') firmwareId?: string
    @field('status') status!: string // 'in_progress' | 'completed' | 'cancelled'
    @field('is_deployment_ready') isDeploymentReady!: boolean

    // Check results
    @field('battery_check_passed') batteryCheckPassed!: boolean
    @field('camera_view_test_passed') cameraViewTestPassed!: boolean
    @field('firmware_check_passed') firmwareCheckPassed!: boolean
    @field('sd_card_check_passed') sdCardCheckPassed!: boolean
    @field('firmware_updated') firmwareUpdated!: boolean

    // LoRaWAN fields
    @field('device_eui') deviceEui?: string
    @field('lorawan_network') lorawanNetwork?: string
    @field('lorawan_registration_completed') lorawanRegistrationCompleted!: boolean

    @field('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt?: Date

    // Sync tracking fields
    @field('_version') version!: number
    @field('_custom_sync_status') customSyncStatus?: string
}
