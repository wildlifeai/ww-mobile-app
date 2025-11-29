import { Q } from '@nozbe/watermelondb'
import database from '../database'
import CaptureMethod from '../database/models/CaptureMethod'
import ActivitySensitivity from '../database/models/ActivitySensitivity'
import AiModel from '../database/models/AiModel'
import SamplingDesign from '../database/models/SamplingDesign'
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

        try {
            await Promise.all([
                this.syncCaptureMethods(),
                this.syncActivitySensitivity(),
                this.syncAiModels(),
                this.syncSamplingDesigns(),
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
}

export default new ReferenceDataService()
