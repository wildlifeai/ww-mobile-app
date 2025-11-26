import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Device from '../database/models/Device'

export const DeviceService = {
    /**
     * Get all devices from local database
     */
    getDevices: async (): Promise<Device[]> => {
        const devicesCollection = database.get<Device>('devices')
        return await devicesCollection.query().fetch()
    },

    /**
     * Get devices by organisation ID
     */
    getDevicesByOrganisation: async (organisationId: string): Promise<Device[]> => {
        const devicesCollection = database.get<Device>('devices')
        return await devicesCollection.query(
            Q.where('organisation_id', organisationId)
        ).fetch()
    },

    /**
     * Get a single device by ID
     */
    getDeviceById: async (deviceId: string): Promise<Device | undefined> => {
        const devicesCollection = database.get<Device>('devices')
        try {
            return await devicesCollection.find(deviceId)
        } catch (error) {
            return undefined
        }
    },

    /**
     * Search devices by name or bluetooth ID
     */
    searchDevices: async (query: string): Promise<Device[]> => {
        const devicesCollection = database.get<Device>('devices')
        return await devicesCollection.query(
            Q.or(
                Q.where('name', Q.like(`%${query}%`)),
                Q.where('bluetooth_id', Q.like(`%${query}%`))
            )
        ).fetch()
    },
}
