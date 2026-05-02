import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Device extends Model {
    static table = 'devices'

    @field('bluetooth_id') bluetoothId!: string
    @field('name') name!: string
    @field('organisation_id') organisationId!: string
    @field('device_eui') deviceEui?: string
    @field('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt?: Date

    // Sync tracking fields
    @field('_version') version!: number
    @field('_custom_sync_status') customSyncStatus?: string
}
