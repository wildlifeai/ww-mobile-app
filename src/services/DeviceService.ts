import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Device from '../database/models/Device'
import DevicePreparation from '../database/models/DevicePreparation'
import Deployment from '../database/models/Deployment'
import { DeviceStatus, DeviceWithStatus, DeviceListItem } from '../types/device'
import OutboxService from './OutboxService'

import ProjectService from './ProjectService'

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
            Q.on('device_preparation', 'device_id', deviceId),
            Q.where('deployment_status_id', 1) // 1 = DEPLOYED
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
                Q.on('device_preparation', 'device_id', deviceId),
                Q.where('deployment_status_id', 1) // 1 = DEPLOYED
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
            Q.on('device_preparation', 'device_id', deviceId),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()
    },

    /**
     * Convert device to list item format for UI
     */
    deviceToListItem: async (device: Device): Promise<DeviceListItem> => {
        const deviceWithStatus = await DeviceService.getDeviceWithStatus(device.id)

        // Get last deployment (active or ended) for status display
        const deploymentsCollection = database.get<Deployment>('deployments')
        const allDeployments = await deploymentsCollection.query(
            Q.on('device_preparation', 'device_id', device.id),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()
        const lastDeployment = allDeployments[0]

        return {
            id: device.id,
            name: device.name,
            bluetoothId: device.bluetoothId,
            status: deviceWithStatus?.status || 'needs_preparation',
            batteryLevel: device.batteryLevel || undefined,
            deploymentName: deviceWithStatus?.activeDeployment?.name || lastDeployment?.name,
            deploymentId: deviceWithStatus?.activeDeployment?.id || lastDeployment?.id,
            deploymentEndDate: (deviceWithStatus?.activeDeployment?.deploymentEnd || lastDeployment?.deploymentEnd)
                ? new Date(deviceWithStatus?.activeDeployment?.deploymentEnd || lastDeployment?.deploymentEnd)
                : undefined,
            lastDeploymentDate: lastDeployment?.deploymentStart
                ? new Date(lastDeployment.deploymentStart)
                : undefined,
            projectName: undefined, // TODO: Resolve project name from deployment
            preparedDate: deviceWithStatus?.preparedDate,
        }
    },

    /**
     * Create a new device from BLE discovery
     */
    createDevice: async (bluetoothId: string, name: string, organisationId: string, userId: string): Promise<Device> => {
        const devicesCollection = database.get<Device>('devices')

        let newDevice: Device | undefined

        await database.write(async () => {
            newDevice = devicesCollection.prepareCreate(device => {
                device.bluetoothId = bluetoothId
                device.name = name
                device.organisationId = organisationId
                device.batteryLevel = 0 // Default
                device.bleFirmwareId = '' // Default
                device.configFirmwareId = ''
                device.himaxFirmwareId = ''
                device.lastBatteryCheck = ''
                device.lastSdCardCheck = ''
            })

            const outboxOp = OutboxService.recordOperation({
                operation: 'CREATE',
                tableName: 'devices',
                recordId: newDevice.id,
                payload: {
                    id: newDevice.id,
                    bluetooth_id: bluetoothId,
                    name: name,
                    organisation_id: organisationId || null,
                    battery_level: 0,
                    ble_firmware_id: null,
                    config_firmware_id: null,
                    himax_firmware_id: null,
                    last_battery_check: null,
                    last_sd_card_check: null,
                    // Timestamps will be handled by backend or defaults
                    modified_by: userId
                }
            })

            await database.batch(newDevice, outboxOp)
        })

        if (!newDevice) throw new Error("Failed to create device")

        return newDevice
    },

    /**
     * Get all devices as list items
     */
    getDevicesAsListItems: async (): Promise<DeviceListItem[]> => {
        const devices = await DeviceService.getDevices()
        return await Promise.all(devices.map(device => DeviceService.deviceToListItem(device)))
    },

    /**
     * Get devices that user has access to via their projects
     * Shows devices that have deployments OR device_preparation in user's accessible projects
     */
    /**
     * Get devices that user has access to via their projects
     * Shows devices that have deployments OR device_preparation in user's accessible projects
     */
    getDevicesForUser: async (userId: string): Promise<DeviceListItem[]> => {
        // 1. Get user's accessible projects using the centralized service
        // This handles Global Admin, Org Admin, Project Member, and Optimistic UI logic
        const userProjects = await ProjectService.getProjectsForUser(userId)

        // 2. Extract Project IDs
        const projectIds = new Set(userProjects.map(p => p.id))
        console.log(`[DeviceService] Found ${projectIds.size} accessible projects for user ${userId}`)

        if (projectIds.size === 0) {
            // Even if no projects, check if user is Global Admin to see ALL devices?
            // ProjectService handles Global Admin by returning ALL projects.
            // But devices might exist WITHOUT a project (unassigned).
            // Logic Check:
            // If Global Admin, ProjectService returns ALL projects.
            // DeviceService should probably return ALL devices too.
            // But ProjectService logic for "Global Admin" returns all *projects*.
            // Does it imply access to all *devices*?
            // Yes, let's assume Global Admin should see everything.

            // Re-check Global Admin legacy check for safety/performance or unassigned devices
            const userRolesCollection = database.get('user_roles')
            const userRoles = await userRolesCollection.query(
                Q.where('user_id', userId),
                Q.where('is_active', true)
            ).fetch()

            const isGlobalAdmin = userRoles.some((r: any) => r.scopeType === 'global')
            if (isGlobalAdmin) {
                return await DeviceService.getDevicesAsListItems()
            }

            return []
        }

        // 3. Get device IDs from deployments in these projects
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deviceIds = new Set<string>()

        // Optimization: Use Q.oneOf if possible, but loop is safe for now
        // We can query deployments where project_id IS IN projectIds via device_preparation
        const projectDeployments = await deploymentsCollection.query(
            Q.on('device_preparation', Q.where('project_id', Q.oneOf(Array.from(projectIds))))
        ).fetch()
        projectDeployments.forEach(d => deviceIds.add(d.deviceId))
        console.log(`[DeviceService] Found ${projectDeployments.length} deployments, cumulative devices: ${deviceIds.size}`)

        // 4. Get device IDs from device_preparation in these projects
        const preparationsCollection = database.get<DevicePreparation>('device_preparation')
        const projectPreparations = await preparationsCollection.query(
            Q.where('project_id', Q.oneOf(Array.from(projectIds)))
        ).fetch()
        projectPreparations.forEach(p => deviceIds.add(p.deviceId))
        console.log(`[DeviceService] Found ${projectPreparations.length} preparations, cumulative devices: ${deviceIds.size}`)

        if (deviceIds.size === 0) {
            // Also check for Org Admin access to unassigned devices?
            // If ProjectService returned projects, it means we have access to those projects.
            // But we might also be an Org Admin who should see unassigned devices in the Org.
            // The previous logic handled Org Admin explicit check.

            // Let's restore Org Admin check for unassigned devices:
            const userRolesCollection = database.get('user_roles')
            const userRoles = await userRolesCollection.query(
                Q.where('user_id', userId),
                Q.where('is_active', true)
            ).fetch()

            const orgAdmins = userRoles.filter((r: any) =>
                r.scopeType === 'organisation' &&
                (r.role === 'project_admin' || r.role === 'ww_admin')
            )

            if (orgAdmins.length > 0) {
                const allDevices: Device[] = []
                for (const adminRole of orgAdmins) {
                    // Cast to any to access scopeId if TS complains, or assume model has it
                    if ((adminRole as any).scopeId) {
                        const orgDevices = await DeviceService.getDevicesByOrganisation((adminRole as any).scopeId)
                        allDevices.push(...orgDevices)
                    }
                }
                const uniqueDevices = Array.from(new Map(allDevices.map(d => [d.id, d])).values())
                return await Promise.all(uniqueDevices.map(d => DeviceService.deviceToListItem(d)))
            }

            return []
        }

        // 5. Get devices and convert to list items
        const devices = await DeviceService.getDevices()
        const userDevices = devices.filter(d => deviceIds.has(d.id))

        // 6. Merge with Org Admin devices (union)
        // If user is Org Admin, they should see ALL devices in org (including unassigned) PLUS devices linked to projects they see (which are likely in same org).
        // For simplicity, let's do the Org Admin check and merge.
        const userRolesCollection = database.get('user_roles')
        const userRoles = await userRolesCollection.query(
            Q.where('user_id', userId),
            Q.where('is_active', true)
        ).fetch()

        const orgAdmins = userRoles.filter((r: any) =>
            r.scopeType === 'organisation' &&
            (r.role === 'project_admin' || r.role === 'ww_admin')
        )

        if (orgAdmins.length > 0) {
            const allDevices: Device[] = []
            // Add project-linked devices first
            allDevices.push(...userDevices)

            // Add org-wide devices
            for (const adminRole of orgAdmins) {
                if ((adminRole as any).scopeId) {
                    const orgDevices = await DeviceService.getDevicesByOrganisation((adminRole as any).scopeId)
                    allDevices.push(...orgDevices)
                }
            }

            const uniqueDevices = Array.from(new Map(allDevices.map(d => [d.id, d])).values())
            return await Promise.all(uniqueDevices.map(d => DeviceService.deviceToListItem(d)))
        }

        return await Promise.all(
            userDevices.map(device => DeviceService.deviceToListItem(device))
        )
    },
}
