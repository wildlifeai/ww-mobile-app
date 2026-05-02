import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class AiModel extends Model {
    static table = 'ai_models'

    @field('server_id') serverId!: string // UUID from Supabase
    @field('name') name!: string
    @field('version') version!: string // Semantic display version (e.g. "v1.1")
    @field('description') description?: string
    @field('model_path') modelPath?: string
    @field('labels_path') labelsPath?: string
    @field('file_size_bytes') fileSizeBytes!: number
    @field('file_type') fileType?: string
    @field('organisation_id') organisationId!: string

    // ── Family & versioning ───────────────────────────────────
    @field('model_family_id') modelFamilyId?: string // UUID FK to ai_model_families
    @field('version_number') versionNumber?: number  // Integer for firmware OP 15

    // ── Lifecycle & integrity ────────────────────────────────
    @field('status') status?: string     // ai_model_status enum
    @field('file_hash') fileHash?: string // SHA-256 of the .TFL binary

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
