import { Q } from '@nozbe/watermelondb'
import database from '../database'
import CaptureMethod from '../database/models/CaptureMethod'
import ActivitySensitivity from '../database/models/ActivitySensitivity'
import AiModel from '../database/models/AiModel'
import SamplingDesign from '../database/models/SamplingDesign'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'

/**
 * ReferenceDataService
 * 
 * Manages read-only reference data (lookup tables) stored in WatermelonDB.
 * These tables are synced one-way from Supabase and enable offline form functionality.
 * 
 * Reference tables:
 * - capture_methods: Wildlife capture methods (motion detection, time lapse, etc.)
 * - activity_sensitivity: Motion detection sensitivity levels (low, medium, high)
 * - ai_models: AI models available for wildlife detection
 * - sampling_designs: Sampling design methods (random, systematic, etc.)
 */
class ReferenceDataService {
    /**
     * Sync all reference data from Supabase to local database
     * Called on app startup if online, or when user manually syncs
     */
    async syncReferenceData(): Promise<void> {
        console.log('📚 Syncing reference data from Supabase...')

        const client = getSupabaseClient()
        const { data: { user } } = await client.auth.getUser()

        if (!user) {
            console.log('📚 No authenticated user - skipping reference data sync')
            return
        }

        try {
            await Promise.all([
                this.syncCaptureMethods(),
                this.syncActivitySensitivity(),
                this.syncAiModels(),
                this.syncSamplingDesigns(),
                this.syncFirmware(),
            ])

            console.log('✅ Reference data sync complete')
        } catch (error) {
            console.error('❌ Reference data sync failed:', error)
            // Don't throw - app can continue with stale data
        }
    }

    // =========================================================================
    // Capture Methods
    // =========================================================================

    private async syncCaptureMethods(): Promise<void> {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('capture_methods')
            .select('*')
            .is('deleted_at', null)
            .order('id')

        if (error) {
            console.error('Failed to fetch capture methods:', error)
            return
        }

        await database.write(async () => {
            const collection = database.get<CaptureMethod>('capture_methods')
            const existingRecords = await collection.query().fetch()
            const existingMap = new Map(existingRecords.map(r => [r.serverId, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            for (const row of data) {
                const existing = existingMap.get(row.id)
                if (existing) {
                    await existing.update(rec => {
                        rec.value = row.value
                        rec.description = row.description
                    })
                } else {
                    await collection.create(rec => {
                        rec.serverId = row.id
                        rec.value = row.value
                        rec.description = row.description
                    })
                }
            }

            // Delete removed
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.serverId)) {
                    await rec.destroyPermanently()
                }
            }
        })

        console.log(`   ✅ Synced ${data.length} capture methods`)
    }

    async getCaptureMethods(): Promise<Array<{ id: number; value: string; description: string }>> {
        const methods = await database.get<CaptureMethod>('capture_methods').query().fetch()
        return methods.map(m => ({
            id: m.serverId,
            value: m.value,
            description: m.description,
        }))
    }

    // =========================================================================
    // Activity Sensitivity
    // =========================================================================

    private async syncActivitySensitivity(): Promise<void> {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('activity_sensitivity')
            .select('*')
            .is('deleted_at', null)
            .eq('is_active', true)
            .order('id')

        if (error) {
            console.error('Failed to fetch activity sensitivity:', error)
            return
        }

        await database.write(async () => {
            const collection = database.get<ActivitySensitivity>('activity_sensitivity')
            const existingRecords = await collection.query().fetch()
            const existingMap = new Map(existingRecords.map(r => [r.serverId, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            for (const row of data) {
                const existing = existingMap.get(row.id)
                if (existing) {
                    await existing.update(rec => {
                        rec.value = row.value
                        rec.description = row.description
                        rec.isActive = row.is_active
                    })
                } else {
                    await collection.create(rec => {
                        rec.serverId = row.id
                        rec.value = row.value
                        rec.description = row.description
                        rec.isActive = row.is_active
                    })
                }
            }

            // Delete removed
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.serverId)) {
                    await rec.destroyPermanently()
                }
            }
        })

        console.log(`   ✅ Synced ${data.length} activity sensitivity levels`)
    }

    async getActivitySensitivity(): Promise<Array<{ id: number; value: string; description: string }>> {
        const items = await database.get<ActivitySensitivity>('activity_sensitivity')
            .query(Q.where('is_active', true))
            .fetch()
        return items.map(item => ({
            id: item.serverId,
            value: item.value,
            description: item.description,
        }))
    }

    // =========================================================================
    // AI Models
    // =========================================================================

    private async syncAiModels(): Promise<void> {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('ai_models')
            .select('*')
            .is('deleted_at', null)
            .order('name')

        if (error) {
            console.error('Failed to fetch AI models:', error)
            return
        }

        await database.write(async () => {
            const collection = database.get<AiModel>('ai_models')
            const existingRecords = await collection.query().fetch()
            const existingMap = new Map(existingRecords.map(r => [r.serverId, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            for (const row of data) {
                const existing = existingMap.get(row.id)
                if (existing) {
                    await existing.update(rec => {
                        rec.name = row.name
                        rec.version = row.version
                        rec.description = row.description ?? undefined
                        rec.organisationId = row.organisation_id
                    })
                } else {
                    await collection.create(rec => {
                        rec.serverId = row.id
                        rec.name = row.name
                        rec.version = row.version
                        rec.description = row.description ?? undefined
                        rec.organisationId = row.organisation_id
                    })
                }
            }

            // Delete removed
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.serverId)) {
                    await rec.destroyPermanently()
                }
            }
        })

        console.log(`   ✅ Synced ${data.length} AI models`)
    }

    async getAiModels(): Promise<Array<{ id: string; name: string; version: string; description: string | null }>> {
        const models = await database.get<AiModel>('ai_models').query().fetch()
        return models.map(m => ({
            id: m.serverId,
            name: m.name,
            version: m.version,
            description: m.description || null,
        }))
    }

    // =========================================================================
    // Sampling Designs
    // =========================================================================

    private async syncSamplingDesigns(): Promise<void> {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase
            .from('sampling_designs')
            .select('*')
            .is('deleted_at', null)
            .eq('is_active', true)
            .order('id')

        if (error) {
            console.error('Failed to fetch sampling designs:', error)
            return
        }

        await database.write(async () => {
            const collection = database.get<SamplingDesign>('sampling_designs')
            const existingRecords = await collection.query().fetch()
            const existingMap = new Map(existingRecords.map(r => [r.serverId, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            for (const row of data) {
                const existing = existingMap.get(row.id)
                if (existing) {
                    await existing.update(rec => {
                        rec.value = row.value
                        rec.description = row.description
                        rec.isActive = row.is_active
                    })
                } else {
                    await collection.create(rec => {
                        rec.serverId = row.id
                        rec.value = row.value
                        rec.description = row.description
                        rec.isActive = row.is_active
                    })
                }
            }

            // Delete removed
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.serverId)) {
                    await rec.destroyPermanently()
                }
            }
        })

        console.log(`   ✅ Synced ${data.length} sampling designs`)
    }

    async getSamplingDesigns(): Promise<Array<{ id: number; value: string; description: string }>> {
        const designs = await database.get<SamplingDesign>('sampling_designs')
            .query(Q.where('is_active', true))
            .fetch()
        return designs.map(d => ({
            id: d.serverId,
            value: d.value,
            description: d.description,
        }))
    }

    // =========================================================================
    // Firmware
    // =========================================================================

    public async syncFirmware(): Promise<void> {
        const supabase = getSupabaseClient()
        // Sync all active firmware metadata
        console.log('[RefData] Syncing firmware...')
        const { data, error } = await supabase
            .from('firmware')
            .select('*')
            .is('deleted_at', null)
            .eq('is_active', true)
            .order('version', { ascending: false })

        if (error) {
            console.error('[RefData] Failed to fetch firmware:', error)
            return
        }

        console.log('[RefData] Fetched firmware records:', data?.length)

        if (!data) return

        await database.write(async () => {
            const collection = database.get<Firmware>('firmware')
            const existingRecords = await collection.query().fetch()
            console.log('[RefData] Local firmware records before sync:', existingRecords.length)

            // Firmware uses UUID (string) for ID, not number like other ref tables
            const existingMap = new Map(existingRecords.map(r => [r.id, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            for (const row of data) {
                const existing = existingMap.get(row.id)
                if (existing) {
                    await existing.update(rec => {
                        rec.version = row.version
                        rec.type = row.type
                        rec.locationPath = row.location_path
                        rec.fileSizeBytes = row.file_size_bytes ?? 0
                        rec.releaseNotes = row.release_notes
                        rec.isActive = row.is_active
                        rec.modifiedBy = row.modified_by
                    })
                } else {
                    await collection.create(rec => {
                        (rec._raw as any).id = row.id // Use Supabase UUID
                        rec.version = row.version
                        rec.type = row.type
                        rec.locationPath = row.location_path
                        rec.fileSizeBytes = row.file_size_bytes ?? 0
                        rec.releaseNotes = row.release_notes
                        rec.isActive = row.is_active
                        rec.modifiedBy = row.modified_by
                    })
                }
            }

            // Delete removed (or no longer active/present in fetch)
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.id)) {
                    await rec.destroyPermanently()
                }
            }

            console.log('[RefData] Firmware sync complete.')
        })

        console.log(`   ✅ Synced ${data.length} firmware records`)
    }

    /**
     * Get the latest firmware for a specific type
     */
    async getLatestFirmware(type: 'ble' | 'himax' | 'config'): Promise<Firmware | null> {
        const firmwares = await database.get<Firmware>('firmware')
            .query(
                Q.where('type', type),
                Q.where('is_active', true)
            )
            .fetch()

        // Sort by version descending using numeric comparison (handles v0.10.0 > v0.2.0)
        const sorted = firmwares.sort((a, b) =>
            b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' })
        )

        console.log(`[RefData] getLatestFirmware(${type}) found:`, sorted.length, sorted[0]?._raw)
        return sorted.length > 0 ? sorted[0] : null
    }
}

export default new ReferenceDataService()
