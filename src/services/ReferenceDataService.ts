import { Q } from '@nozbe/watermelondb'
import database from '../database'
import CaptureMethod from '../database/models/CaptureMethod'
import ActivitySensitivity from '../database/models/ActivitySensitivity'
import AiModel from '../database/models/AiModel'
import SamplingDesign from '../database/models/SamplingDesign'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'
import { log, logError } from '../utils/logger'


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
        log('📚 Syncing reference data from Supabase...')

        const client = getSupabaseClient()

        // Robustness: Wait for auth session to hydrate if needed (up to 3 retries)
        let user = null
        let attempts = 0
        const MAX_ATTEMPTS = 3
        const RETRY_DELAY_MS = 1000

        while (attempts < MAX_ATTEMPTS) {
            const { data } = await client.auth.getUser()
            user = data.user
            if (user) break

            attempts++
            if (attempts < MAX_ATTEMPTS) {
                log(`📚 Auth user check attempt ${attempts} failed, retrying in ${RETRY_DELAY_MS}ms...`)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
            }
        }

        if (!user) {
            log('📚 No authenticated user found after retries - skipping reference data sync')
            return
        }

        try {
            log('📚 Starting parallel sync of reference tables...')
            await Promise.all([
                (async () => { log('📚 Syncing capture methods...'); await this.syncCaptureMethods() })(),
                (async () => { log('📚 Syncing activity sensitivity...'); await this.syncActivitySensitivity() })(),
                (async () => { log('📚 Syncing AI models...'); await this.syncAiModels() })(),
                (async () => { log('📚 Syncing sampling designs...'); await this.syncSamplingDesigns() })(),
                (async () => { log('📚 Syncing firmware...'); await this.syncFirmware() })(),
            ])

            log('✅ Reference data sync complete')
        } catch (error) {
            logError('❌ Reference data sync failed:', error)
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
            logError('Failed to fetch capture methods:', error)
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

        log(`   ✅ Synced ${data.length} capture methods`)
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
            logError('Failed to fetch activity sensitivity:', error)
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

        log(`   ✅ Synced ${data.length} activity sensitivity levels`)
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
            logError('Failed to fetch AI models:', error)
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

        log(`   ✅ Synced ${data.length} AI models`)
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
            logError('Failed to fetch sampling designs:', error)
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

        log(`   ✅ Synced ${data.length} sampling designs`)
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
        log('[RefData] Syncing firmware...')
        const { data, error } = await supabase
            .from('firmware')
            .select('*')
            .is('deleted_at', null)
            .eq('is_active', true)
            .order('version', { ascending: false })

        if (error) {
            logError('[RefData] Failed to fetch firmware:', error)
            return
        }

        if (!data || data.length === 0) {
            log('[RefData] No firmware data received from server')
            return
        }

        await database.write(async () => {
            const collection = database.get<Firmware>('firmware')
            const existingRecords = await collection.query().fetch()
            log('[RefData] Local firmware records before sync:', existingRecords.length)

            // Firmware uses UUID (string) for ID, not number like other ref tables
            const existingMap = new Map(existingRecords.map(r => [r.id, r]))
            const serverIds = new Set(data.map(d => d.id))

            // Upsert
            log(`[RefData] Raw firmware data:`, JSON.stringify(data))
            for (const row of data) {
                try {
                    if (!row) {
                        logError('[RefData] Found undefined row in firmware data!')
                        continue
                    }
                    log(`[RefData] Processing firmware row: ${row.id}, type=${row.type}`)
                    const existing = existingMap.get(row.id)
                    if (existing) {
                        await existing.update(rec => {
                            rec.version = row.version || '0.0.0'
                            rec.type = row.type || 'ble'
                            rec.locationPath = row.location_path || ''
                            rec.fileSizeBytes = row.file_size_bytes ?? 0
                            rec.releaseNotes = row.release_notes
                            rec.isActive = row.is_active || false
                            rec.modifiedBy = row.modified_by || 'system'
                        })
                    } else {
                        await collection.create(rec => {
                            (rec._raw as any).id = row.id // Use Supabase UUID
                            rec.version = row.version || '0.0.0'
                            rec.type = row.type || 'ble'
                            rec.locationPath = row.location_path || ''
                            rec.fileSizeBytes = row.file_size_bytes ?? 0
                            rec.releaseNotes = row.release_notes
                            rec.isActive = row.is_active || false
                            rec.modifiedBy = row.modified_by || 'system'
                        })
                    }
                } catch (err) {
                    logError(`[RefData] Failed to process firmware row ${row?.id}:`, err)
                }
            }

            // Delete removed (or no longer active/present in fetch)
            for (const rec of existingRecords) {
                if (!serverIds.has(rec.id)) {
                    await rec.destroyPermanently()
                }
            }

            log('[RefData] Firmware sync complete.')
        })

        log(`   ✅ Synced ${data.length} firmware records`)
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
        const sorted = firmwares.sort((a, b) => {
            const versionA = a?.version || '0.0.0'
            const versionB = b?.version || '0.0.0'
            return versionB.localeCompare(versionA, undefined, { numeric: true, sensitivity: 'base' })
        })

        log(`[RefData] getLatestFirmware(${type}) found:`, sorted.length, sorted[0]?._raw)
        return sorted.length > 0 ? sorted[0] : null
    }
}

export default new ReferenceDataService()
