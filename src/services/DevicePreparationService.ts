import { Q } from '@nozbe/watermelondb'
import database from '../database'
import DevicePreparation from '../database/models/DevicePreparation'

export const DevicePreparationService = {
    /**
     * Create a new device preparation record
     */
    createPreparation: async (deviceId: string, projectId: string, modifiedBy: string): Promise<DevicePreparation> => {
        return await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')

            return await preparationsCollection.create((preparation) => {
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
        })
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
        return await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            return await preparation.update((prep) => {
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
        })
    },

    /**
     * Complete a device preparation
     */
    completePreparation: async (preparationId: string, isDeploymentReady: boolean): Promise<DevicePreparation> => {
        return await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            return await preparation.update((prep) => {
                prep.status = 'completed'
                prep.isDeploymentReady = isDeploymentReady
            })
        })
    },

    /**
     * Cancel a device preparation
     */
    cancelPreparation: async (preparationId: string): Promise<DevicePreparation> => {
        return await database.write(async () => {
            const preparationsCollection = database.get<DevicePreparation>('device_preparation')
            const preparation = await preparationsCollection.find(preparationId)

            return await preparation.update((prep) => {
                prep.status = 'cancelled'
            })
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
     * Cancel any in-progress preparations for a device
     */
    cancelInProgressPreparations: async (deviceId: string): Promise<void> => {
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const inProgressPreparations = await preparationsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('status', 'in_progress')
        ).fetch()

        await database.write(async () => {
            for (const prep of inProgressPreparations) {
                await prep.update((p) => {
                    p.status = 'cancelled'
                })
            }
        })
    },

    /**
     * Record battery check result
     */
    recordBatteryCheck: async (preparationId: string, passed: boolean): Promise<void> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            batteryCheckPassed: passed
        })
    },

    /**
     * Record SD card check result
     */
    recordSdCardCheck: async (preparationId: string, passed: boolean): Promise<void> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            sdCardCheckPassed: passed
        })
    },

    /**
     * Record LoRaWAN check result
     */
    recordLoRaWANCheck: async (preparationId: string, passed: boolean): Promise<void> => {
        return await DevicePreparationService.updatePreparation(preparationId, {
            lorawanRegistrationCompleted: passed
        })
    },

    /**
     * Start a new preparation workflow
     */
    startPreparation: async (deviceId: string, projectId: string, modifiedBy: string): Promise<DevicePreparation> => {
        // Cancel any existing in-progress preparations first
        await DevicePreparationService.cancelInProgressPreparations(deviceId)
        return await DevicePreparationService.createPreparation(deviceId, projectId, modifiedBy)
    },
}
