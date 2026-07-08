import { Model } from '@nozbe/watermelondb'
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Firmware extends Model {
    static table = 'firmware'

    @text('name') name!: string
    @text('version') version!: string
    @text('type') type!: string
    @text('location_path') locationPath!: string
    @field('file_size_bytes') fileSizeBytes!: number
    @text('release_notes') releaseNotes!: string | null
    @field('is_active') isActive!: boolean
    @text('crc_checksum') crcChecksum!: string | null
    @text('build_date') buildDate!: string | null
    /** Camera variant the Himax image was built for: 'RP3' | 'HM0360' | null (BLE/legacy) */
    @text('camera_variant') cameraVariant!: string | null
    @text('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
    @readonly @date('deleted_at') deletedAt!: Date | null
}
