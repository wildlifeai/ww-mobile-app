import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Device from '../database/models/Device'
import DevicePreparation from '../database/models/DevicePreparation'
import Deployment from '../database/models/Deployment'
import { DeviceStatus, DeviceWithStatus, DeviceListItem } from '../types/device'

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
     * Get a single device by Bluetooth ID
     */
    getDeviceByBluetoothId: async (bluetoothId: string): Promise<Device | undefined> => {
        const devicesCollection = database.get<Device>('devices')
        const devices = await devicesCollection.query(
            Q.where('bluetooth_id', bluetoothId)
        ).fetch()
        return devices.length > 0 ? devices[0] : undefined
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

    /**
     * Calculate device status based on deployments and preparations
     */
    calculateDeviceStatus: async (deviceId: string): Promise<DeviceStatus> => {
        // Check for active deployment
        const deploymentsCollection = database.get<Deployment>('deployments')
        const activeDeployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_end', null)
        ).fetch()

        if (activeDeployments.length > 0) {
            return 'deployed'
        }

        // Check for completed preparation
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const completedPreparations = await preparationsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('status', 'completed'),
            Q.sortBy('created_at', Q.desc)
        ).fetch()

        if (completedPreparations.length > 0) {
            return 'prepared'
        }

        return 'needs_preparation'
    },

    /**
     * Get device with full status information
     */
    getDeviceWithStatus: async (deviceId: string): Promise<DeviceWithStatus | undefined> => {
        const device = await DeviceService.getDeviceById(deviceId)
        if (!device) return undefined

        const status = await DeviceService.calculateDeviceStatus(deviceId)

        // Get active deployment if deployed
        let activeDeployment: Deployment | undefined
        if (status === 'deployed') {
            const deploymentsCollection = database.get<Deployment>('deployments')
            const deployments = await deploymentsCollection.query(
                Q.where('device_id', deviceId),
                Q.where('deployment_end', null)
            ).fetch()
            activeDeployment = deployments[0]
        }

        // Get last preparation
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const preparations = await preparationsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('status', 'completed'),
            Q.sortBy('created_at', Q.desc)
        ).fetch()
        const lastPreparation = preparations[0]

        return {
            device,
            status,
            activeDeployment,
            lastPreparation,
            preparedDate: lastPreparation?.createdAt,
        }
    },

    /**
     * Get deployment history for a device
     */
    getDeviceDeploymentHistory: async (deviceId: string): Promise<Deployment[]> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        return await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()
    },

    /**
     * Convert device to list item format for UI
     */
    deviceToListItem: async (device: Device): Promise<DeviceListItem> => {
        const deviceWithStatus = await DeviceService.getDeviceWithStatus(device.id)

        return {
            id: device.id,
            name: device.name,
            bluetoothId: device.bluetoothId,
            status: deviceWithStatus?.status || 'needs_preparation',
            batteryLevel: device.batteryLevel || undefined,
            deploymentName: deviceWithStatus?.activeDeployment?.name,
            projectName: undefined, // TODO: Resolve project name from deployment
            preparedDate: deviceWithStatus?.preparedDate,
        }
    },

    /**
     * Create a new device from BLE discovery
     */
    createDevice: async (bluetoothId: string, name: string, organisationId: string): Promise<Device> => {
        const devicesCollection = database.get<Device>('devices')
        return await database.write(async () => {
            return await devicesCollection.create(device => {
                device.bluetoothId = bluetoothId
                device.name = name
                device.organisationId = organisationId
                device.batteryLevel = 0 // Default
                device.firmwareId = '' // Default
                device.lastBatteryCheck = ''
                device.lastSdCardCheck = ''
            })
        })
    },

    /**
     * Get all devices as list items
     */
    getDevicesAsListItems: async (): Promise<DeviceListItem[]> => {
        const devices = await DeviceService.getDevices()
        return await Promise.all(devices.map(device => DeviceService.deviceToListItem(device)))
    },
}
