import { Model } from '@nozbe/watermelondb'
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Firmware extends Model {
    static table = 'firmware'

    @text('version') version!: string
    @text('type') type!: string
    @text('location_path') locationPath!: string
    @field('file_size_bytes') fileSizeBytes!: number
    @text('release_notes') releaseNotes!: string | null
    @field('is_active') isActive!: boolean
    @text('modified_by') modifiedBy!: string

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
    @readonly @date('deleted_at') deletedAt!: Date | null
}
