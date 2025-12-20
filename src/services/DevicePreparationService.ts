import { Q } from '@nozbe/watermelondb'
import database from '../database'
import DevicePreparation from '../database/models/DevicePreparation'
import OutboxService from './OutboxService'
import SupabaseSyncService from './SupabaseSyncService'
import { getSupabaseClient } from './supabase'

export const DevicePreparationService = {
    // ... existing methods ...

    /**
     * Start a new preparation workflow
     */
    startPreparation: async (deviceId: string, projectId: string, modifiedBy: string): Promise<DevicePreparation> => {
        // 1. Try to clean server state (best effort, handles zombie records)
        await DevicePreparationService.ensureServerStateClean(deviceId)

        // 2. Cancel any existing in-progress preparations locally
        await DevicePreparationService.cancelInProgressPreparations(deviceId)

        // 3. CRITICAL: Trigger sync to push cancellations to server BEFORE creating new preparation
        // This prevents race condition where server still has old in_progress record
        console.log('[DevPrepService] Triggering sync to push cancellations before creating new preparation')
        try {
            await SupabaseSyncService.sync()
            console.log('[DevPrepService] Sync complete, proceeding with new preparation creation')
        } catch (syncErr) {
            console.warn('[DevPrepService] Sync failed, proceeding anyway:', syncErr)
            // Continue even if sync fails - the server cleanup should have handled it
        }

        // 4. Create new preparation
        return await DevicePreparationService.createPreparation(deviceId, projectId, modifiedBy)
    },
    /**
     * Create a new device preparation record
     */
    /**
     * Create a new device preparation record
     */
    createPreparation: async (deviceId: string, projectId: string, modifiedBy: string): Promise<DevicePreparation> => {
        console.log('[DevPrepService] Creating preparation for device:', deviceId, 'project:', projectId)

        let newPrep: DevicePreparation | undefined

        await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')

            // 1. Prepare record
            newPrep = preparationsCollection.prepareCreate((preparation) => {
                preparation.deviceId = deviceId
                preparation.projectId = projectId
                preparation.modifiedBy = modifiedBy
                preparation.status = 'in_progress'
                preparation.isDeploymentReady = false
                preparation.batteryCheckPassed = false
                preparation.cameraViewTestPassed = false
                preparation.firmwareCheckPassed = false
                preparation.sdCardCheckPassed = false
                preparation.firmwareUpdated = false
                preparation.lorawanRegistrationCompleted = false
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'CREATE',
                tableName: 'device_preparation',
                recordId: newPrep.id,
                payload: mapModelToPayload(newPrep),
                userId: modifiedBy || undefined, // modifiedBy holds the user ID
            })

            // 3. Execute batch
            await database.batch(newPrep, outboxOp)
            console.log('[DevPrepService] Created preparation and outbox record:', newPrep.id)
        })

        if (!newPrep) throw new Error("Failed to create preparation instance")

        // Trigger background sync
        SupabaseSyncService.debouncedSync()

        return newPrep
    },

    /**
     * Update an existing device preparation record
     */
    updatePreparation: async (
        preparationId: string,
        updates: Partial<{
            batteryCheckPassed: boolean
            cameraViewTestPassed: boolean
            firmwareCheckPassed: boolean
            sdCardCheckPassed: boolean
            firmwareUpdated: boolean
            lorawanRegistrationCompleted: boolean
            aiModelId: string
            firmwareId: string
            deviceEui: string
            lorawanNetwork: string
        }>
    ): Promise<DevicePreparation> => {
        console.log('[DevPrepService] Updating preparation:', preparationId, updates)

        await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            // 1. Prepare update
            const prepUpdate = preparation.prepareUpdate((prep) => {
                if (updates.batteryCheckPassed !== undefined) prep.batteryCheckPassed = updates.batteryCheckPassed
                if (updates.cameraViewTestPassed !== undefined) prep.cameraViewTestPassed = updates.cameraViewTestPassed
                if (updates.firmwareCheckPassed !== undefined) prep.firmwareCheckPassed = updates.firmwareCheckPassed
                if (updates.sdCardCheckPassed !== undefined) prep.sdCardCheckPassed = updates.sdCardCheckPassed
                if (updates.firmwareUpdated !== undefined) prep.firmwareUpdated = updates.firmwareUpdated
                if (updates.lorawanRegistrationCompleted !== undefined) prep.lorawanRegistrationCompleted = updates.lorawanRegistrationCompleted
                if (updates.aiModelId) prep.aiModelId = updates.aiModelId
                if (updates.firmwareId) prep.firmwareId = updates.firmwareId
                if (updates.deviceEui) prep.deviceEui = updates.deviceEui
                if (updates.lorawanNetwork) prep.lorawanNetwork = updates.lorawanNetwork
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'UPDATE',
                tableName: 'device_preparation',
                recordId: preparation.id,
                payload: mapModelToPayload(preparation), // Using prepared updated state by WatermelonDB magic or just current? 
                // Note: WatermelonDB prepareUpdate mutates the model in memory immediately for the batch, so this payload will reflect updates.
                userId: preparation.modifiedBy || undefined,
            })

            // 3. Execute batch
            await database.batch(prepUpdate, outboxOp)
        })

        // Trigger background sync
        SupabaseSyncService.debouncedSync()

        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        return await preparationsCollection.find(preparationId)
    },

    /**
     * Complete a device preparation
     */
    completePreparation: async (preparationId: string, isDeploymentReady: boolean): Promise<DevicePreparation> => {
        console.log('[DevPrepService] Completing preparation:', preparationId, 'ready:', isDeploymentReady)

        await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            // 1. Prepare update
            const prepUpdate = preparation.prepareUpdate((prep) => {
                prep.status = 'completed'
                prep.isDeploymentReady = isDeploymentReady
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'UPDATE',
                tableName: 'device_preparation',
                recordId: preparation.id,
                payload: mapModelToPayload(preparation),
                userId: preparation.modifiedBy || undefined,
            })

            // 3. Execute batch
            await database.batch(prepUpdate, outboxOp)
            console.log('[DevPrepService] Preparation completed and queued for sync:', preparation.id)
        })

        // Trigger background sync
        SupabaseSyncService.debouncedSync()

        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        return await preparationsCollection.find(preparationId)
    },

    /**
     * Cancel a device preparation
     */
    cancelPreparation: async (preparationId: string): Promise<DevicePreparation> => {
        return await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            // 1. Prepare update
            const prepUpdate = preparation.prepareUpdate((prep) => {
                prep.status = 'cancelled'
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'UPDATE',
                tableName: 'device_preparation',
                recordId: preparation.id,
                payload: mapModelToPayload(preparation),
                userId: preparation.modifiedBy || undefined,
            })

            // 3. Execute batch
            await database.batch(prepUpdate, outboxOp)

            // Trigger background sync
            SupabaseSyncService.debouncedSync()

            return preparation
        })
    },

    /**
     * Get most recent completed preparation for a device
     */
    getLastCompletedPreparation: async (deviceId: string): Promise<DevicePreparation | undefined> => {
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const preparations = await preparationsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('status', 'completed'),
            Q.sortBy('created_at', Q.desc)
        ).fetch()

        return preparations[0]
    },

    /**
     * Get preparation by ID
     */
    getPreparationById: async (id: string): Promise<DevicePreparation | undefined> => {
        try {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            return await preparationsCollection.find(id)
        } catch (error) {
            console.log('[DevPrepService] Preparation not found:', id)
            return undefined
        }
    },

    /**
     * Cancel any in-progress preparations for a device
     */
    cancelInProgressPreparations: async (deviceId: string): Promise<void> => {
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const inProgressPreparations = await preparationsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('status', 'in_progress')
        ).fetch()

        if (inProgressPreparations.length === 0) return

        await database.write(async () => {
            const batchOperations = []

            for (const prep of inProgressPreparations) {
                // 1. Prepare update
                const prepUpdate = prep.prepareUpdate((p) => {
                    p.status = 'cancelled'
                })
                batchOperations.push(prepUpdate)

                // 2. Prepare outbox record
                const outboxOp = OutboxService.recordOperation({
                    operation: 'UPDATE',
                    tableName: 'device_preparation',
                    recordId: prep.id,
                    payload: mapModelToPayload(prep),
                    userId: prep.modifiedBy || undefined,
                })
                batchOperations.push(outboxOp)
            }

            // 3. Execute batch
            await database.batch(...batchOperations)
        })

        // Trigger background sync
        SupabaseSyncService.debouncedSync()
    },

    /**
     * Record battery check result
     */
    recordBatteryCheck: async (preparationId: string, passed: boolean): Promise<DevicePreparation> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            batteryCheckPassed: passed
        })
    },

    /**
     * Record SD card check result
     */
    recordSdCardCheck: async (preparationId: string, passed: boolean): Promise<DevicePreparation> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            sdCardCheckPassed: passed
        })
    },

    /**
     * Record LoRaWAN check result
     */
    recordLoRaWANCheck: async (preparationId: string, passed: boolean): Promise<DevicePreparation> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            lorawanRegistrationCompleted: passed
        })
    },



    /**
     * Ensure server state is clean by cancelling any active preparations directly on Supabase
     * This avoids unique constraint violations when creating a new preparation
     * 
     * NOTE: We unconditionally issue the UPDATE without querying first because RLS policies
     * might prevent us from seeing records that still exist on the server
     */
    ensureServerStateClean: async (deviceId: string): Promise<void> => {
        try {
            console.log(`[DevPrepService] Unconditionally cancelling any in_progress preparations for device: ${deviceId}`)
            const supabase = getSupabaseClient()

            // 1. Try RPC first (e.g. force_cancel_active_preparation) if available
            // This is the preferred method as it uses SECURITY DEFINER to bypass RLS
            const { error: rpcError } = await supabase.rpc('force_cancel_active_preparation', {
                p_device_id: deviceId
            })

            if (!rpcError) {
                console.log('[DevPrepService] ✅ Force-cancelled preparations via RPC')
                return
            }

            console.warn('[DevPrepService] RPC failed (migration likely missing), falling back to direct update:', rpcError.message)

            // 2. Fallback: Direct UPDATE (subject to RLS visibility)
            const { error: updateError, data } = await supabase
                .from('device_preparation')
                .update({ status: 'cancelled' })
                .eq('device_id', deviceId)
                .eq('status', 'in_progress')
                .is('deleted_at', null)
                .select('id')

            if (updateError) {
                console.error('[DevPrepService] Failed to cancel server preparations:', updateError)
            } else {
                const count = data?.length || 0
                if (count > 0) {
                    console.log(`[DevPrepService] ✅ Cancelled ${count} in_progress preparation(s) on server (Direct Update)`)
                } else {
                    console.log('[DevPrepService] No in_progress preparations found to cancel (clean state)')
                }
            }
        } catch (e) {
            console.error('[DevPrepService] Exception in ensureServerStateClean:', e)
            // Don't block flow if offline or error
        }
    },
}

/**
 * Helper to map model to plain object for sync (snake_case)
 */
function mapModelToPayload(model: DevicePreparation): any {
    return {
        id: model.id,
        device_id: model.deviceId,
        project_id: model.projectId || null,
        ai_model_id: model.aiModelId || null,
        ble_firmware_id: model.firmwareId || null,
        status: model.status,
        is_deployment_ready: model.isDeploymentReady,

        // Check results - these might not all be needed by backend depending on logic but good to include
        battery_check_passed: model.batteryCheckPassed,
        camera_view_test_passed: model.cameraViewTestPassed,
        firmware_check_passed: model.firmwareCheckPassed,
        sd_card_check_passed: model.sdCardCheckPassed,
        firmware_updated: model.firmwareUpdated,

        // LoRaWAN
        device_eui: model.deviceEui || null,
        lorawan_network: model.lorawanNetwork || null,
        lorawan_registration_completed: model.lorawanRegistrationCompleted,

        modified_by: model.modifiedBy || null,
        created_at: new Date(model.createdAt).toISOString(),
        updated_at: new Date(model.updatedAt).toISOString(),
        deleted_at: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
    }
}
