import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Device from '../database/models/Device'
import Deployment from '../database/models/Deployment'
import { DeviceStatus, DeviceWithStatus } from '../types/device'
import OutboxService from './OutboxService'
import { DEPLOYMENT_STATUS } from './DeploymentService'

import { isKnownOffline } from './connectivityWatch'
import { DeviceRow, fetchDeviceRowByBluetoothId, prepareDeviceRow } from './serverDevices'
import { log, logError } from '../utils/logger'
import { logCloudFailure } from '../utils/networkErrors'

/**
 * What the server said about a camera this phone has not met (#451). `found`
 * carries the device, now on the phone under the server's id.
 */
export type ServerDeviceLookup =
    | { kind: 'found'; device: Device }
    | { kind: 'none' }
    | { kind: 'unchecked' }

/**
 * How long the scanner waits for that answer before registering the camera
 * itself. Short, because missing it costs little: a second id for a camera the
 * server has is refused 23505, and the push then takes the server's row
 * (SupabaseSyncService.settleTakenBluetoothId).
 */
const SERVER_LOOKUP_MS = 5_000


export const DeviceService = {
    /**
     * Get all devices from local database
     */
    getDevices: async (): Promise<Device[]> => {
        const devicesCollection = database.get<Device>('devices')
        return await devicesCollection.query().fetch()
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
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.STARTED)
        ).fetch()

        if (activeDeployments.length > 0) {
            return 'deployed'
        }

        // Check if any ended deployment exists
        const endedDeployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.ENDED),
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
        const deploymentsCollection = database.get<Deployment>('deployments')

        // Get active deployment if deployed
        let activeDeployment: Deployment | undefined
        if (status === 'deployed') {
            const deployments = await deploymentsCollection.query(
                Q.where('device_id', deviceId),
                Q.where('deployment_status_id', DEPLOYMENT_STATUS.STARTED)
            ).fetch()
            activeDeployment = deployments[0]
        }

        // Get most recent ended deployment (for "last session" display)
        let lastDeployment: Deployment | undefined
        const endedDeployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.ENDED),
            Q.sortBy('deployment_end', Q.desc),
            Q.take(1)
        ).fetch()
        lastDeployment = endedDeployments[0]

        return {
            device,
            status,
            activeDeployment,
            lastDeployment,
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
     * Ask the server for the camera with this Bluetooth id, before the scanner
     * registers one the phone has not met (#451). A row this account may read
     * is written to the phone under the server's id, with no outbox CREATE:
     * `bluetooth_id` is unique on the server, so a second id for the camera
     * would be refused on every sync. "none" means no live row: the camera is
     * unregistered, or its row was deleted (#501). Offline, failed or slower
     * than SERVER_LOOKUP_MS, the answer is "unchecked".
     */
    adoptFromServer: async (bluetoothId: string): Promise<ServerDeviceLookup> => {
        if (await isKnownOffline()) return { kind: 'unchecked' }

        let timer: ReturnType<typeof setTimeout> | undefined
        const timedOut = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new TypeError(`Network request timed out after ${SERVER_LOOKUP_MS / 1000} s`)),
                SERVER_LOOKUP_MS,
            )
        })
        let row: DeviceRow | null
        try {
            row = await Promise.race([fetchDeviceRowByBluetoothId(bluetoothId), timedOut])
        } catch (error) {
            logCloudFailure('[DeviceService] Could not ask the server about this camera:', error)
            return { kind: 'unchecked' }
        } finally {
            clearTimeout(timer)
        }
        if (!row) return { kind: 'none' }

        const serverRow = row
        try {
            await database.write(async () => {
                await database.batch(await prepareDeviceRow(serverRow))
            })
            const device = await DeviceService.getDeviceById(serverRow.id)
            if (!device) throw new Error(`device ${serverRow.id} not found after writing it`)
            log(`[DeviceService] Camera ${bluetoothId} is on the server as ${serverRow.id}, written to the phone`)
            return { kind: 'found', device }
        } catch (error) {
            logError("[DeviceService] Could not write the server's row for this camera to the phone:", error)
            return { kind: 'unchecked' }
        }
    },

    /**
     * Register a camera the server has no row for, from BLE discovery.
     *
     * No organisation: since ww-backend #346 a camera belongs to none (#327).
     * Any signed-in account but the demo one may register one, and every such
     * account reads every camera. `devices.organisation_id` stays on both
     * sides until nothing writes it, and nothing here does (#501).
     */
    createDevice: async (bluetoothId: string, name: string, userId: string): Promise<Device> => {
        const devicesCollection = database.get<Device>('devices')

        let newDevice: Device | undefined

        await database.write(async () => {
            newDevice = devicesCollection.prepareCreate(device => {
                device.bluetoothId = bluetoothId
                device.name = name
            })

            const outboxOp = OutboxService.recordOperation({
                operation: 'CREATE',
                tableName: 'devices',
                recordId: newDevice.id,
                payload: {
                    id: newDevice.id,
                    bluetooth_id: bluetoothId,
                    name: name,
                    modified_by: userId
                }
            })

            await database.batch(newDevice, outboxOp)
        })

        if (!newDevice) throw new Error("Failed to create device")

        return newDevice
    },
}
