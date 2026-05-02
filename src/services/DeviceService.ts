import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Device from '../database/models/Device'
import Deployment from '../database/models/Deployment'
import { DeviceStatus, DeviceWithStatus, DeviceListItem } from '../types/device'
import OutboxService from './OutboxService'

import ProjectService from './ProjectService'
import { log } from '../utils/logger'


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
     * Calculate device status based on deployments
     */
    calculateDeviceStatus: async (deviceId: string): Promise<DeviceStatus> => {
        // Check for active deployment
        const deploymentsCollection = database.get<Deployment>('deployments')
        const activeDeployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', 1) // 1 = DEPLOYED
        ).fetch()

        if (activeDeployments.length > 0) {
            return 'deployed'
        }

        // Check if any ended deployment exists
        const endedDeployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', Q.notEq(1)),
            Q.sortBy('deployment_end', Q.desc),
            Q.take(1)
        ).fetch()

        if (endedDeployments.length > 0) {
            return 'prepared' // Device has been deployed before
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
                Q.where('deployment_status_id', 1) // 1 = DEPLOYED
            ).fetch()
            activeDeployment = deployments[0]
        }

        return {
            device,
            status,
            activeDeployment,
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

        // Get last deployment (active or ended) for status display
        const deploymentsCollection = database.get<Deployment>('deployments')
        const allDeployments = await deploymentsCollection.query(
            Q.where('device_id', device.id),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()
        const lastDeployment = allDeployments[0]

        return {
            id: device.id,
            name: device.name,
            bluetoothId: device.bluetoothId,
            status: deviceWithStatus?.status || 'needs_preparation',
            locationName: deviceWithStatus?.activeDeployment?.locationName || lastDeployment?.locationName,
            deploymentId: deviceWithStatus?.activeDeployment?.id || lastDeployment?.id,
            deploymentEndDate: (deviceWithStatus?.activeDeployment?.deploymentEnd || lastDeployment?.deploymentEnd)
                ? new Date((deviceWithStatus?.activeDeployment?.deploymentEnd || lastDeployment?.deploymentEnd)!)
                : undefined,
            lastDeploymentDate: lastDeployment?.deploymentStart
                ? new Date(lastDeployment.deploymentStart)
                : undefined,
            projectName: undefined, // TODO: Resolve project name from deployment
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
     * Get devices for a user scoped to a specific organisation.
     * Reuses getDevicesForUser then filters to only devices belonging to the given org.
     */
    getDevicesForUserInOrganisation: async (userId: string, organisationId: string): Promise<DeviceListItem[]> => {
        const allDevices = await DeviceService.getDevicesForUser(userId)

        // Get device records for this organisation to build a set of valid IDs
        const orgDevices = await DeviceService.getDevicesByOrganisation(organisationId)
        const orgDeviceIds = new Set(orgDevices.map(d => d.id))

        return allDevices.filter(d => orgDeviceIds.has(d.id))
    },

    /**
     * Get devices that user has access to via their projects
     * Shows devices that have deployments in user's accessible projects
     */
    getDevicesForUser: async (userId: string): Promise<DeviceListItem[]> => {
        // 1. Get user's accessible projects using the centralized service
        // This handles Global Admin, Org Admin, Project Member, and Optimistic UI logic
        const userProjects = await ProjectService.getProjectsForUser(userId)

        // 2. Extract Project IDs
        const projectIds = new Set(userProjects.map(p => p.id))
        log(`[DeviceService] Found ${projectIds.size} accessible projects for user ${userId}`)

        if (projectIds.size === 0) {
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

        const projectDeployments = await deploymentsCollection.query(
            Q.where('project_id', Q.oneOf(Array.from(projectIds)))
        ).fetch()
        projectDeployments.forEach(d => {
            if (d.deviceId) deviceIds.add(d.deviceId)
        })
        log(`[DeviceService] Found ${projectDeployments.length} deployments, cumulative devices: ${deviceIds.size}`)

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
