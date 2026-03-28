import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { Q } from '@nozbe/watermelondb'
import database from '../../database'
import Deployment from '../../database/models/Deployment'
import Device from '../../database/models/Device'
import { DeviceCard } from '../../components/DeviceCard'
import { StandardizedListLayout } from '../../components/ui/StandardizedListLayout'
import { DeviceListItem, DeviceStatus } from '../../types/device'
import { DeviceService } from '../../services/DeviceService'
import { AppParams } from '../../navigation/types'

export const ProjectDevicesScreen = () => {
    const route = useRoute<AppParams<"ProjectDevicesScreen">>()
    const { projectId, projectName } = route.params

    const [devices, setDevices] = useState<DeviceListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const loadDevices = useCallback(async () => {
        try {
            setLoading(true)

            // Find all deployments for this project to get device IDs
            const deployments = await database.get<Deployment>('deployments')
                .query(Q.where('project_id', projectId))
                .fetch()

            const deviceIds = new Set([
                ...deployments.map(d => d.deviceId)
            ])

            if (deviceIds.size > 0) {
                const uniqueDevices = await database.get<Device>('devices')
                    .query(Q.where('id', Q.oneOf(Array.from(deviceIds))))
                    .fetch()

                // Map to DeviceListItem to be compatible with DeviceCard
                const listItems: DeviceListItem[] = await Promise.all(
                    uniqueDevices.map(async (device) => {
                        const status: DeviceStatus = await DeviceService.calculateDeviceStatus(device.id)

                        // Attempt to find last deployment
                        const deviceDeployments = deployments.filter((d: Deployment) => d.deviceId === device.id)
                        deviceDeployments.sort((a: Deployment, b: Deployment) => b.deploymentStart.getTime() - a.deploymentStart.getTime())
                        const lastDeployment = deviceDeployments[0]

                        return {
                            id: device.id,
                            bluetoothId: device.bluetoothId,
                            name: device.name,
                            status,
                            lastDeploymentDate: lastDeployment?.deploymentStart ? new Date(lastDeployment.deploymentStart) : undefined,
                        }
                    })
                )

                // Sort alphabetically
                listItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                setDevices(listItems)
            } else {
                setDevices([])
            }
        } catch (error) {
            console.error('Error loading project devices:', error)
            Alert.alert('Error', 'Failed to load project devices')
            setDevices([])
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        loadDevices()
    }, [loadDevices])

    // Filter devices locally
    const filteredDevices = devices.filter(device =>
        !searchQuery ||
        device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.bluetoothId?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const renderDeviceItem = useCallback(({ item }: { item: DeviceListItem }) => (
        <DeviceCard
            device={item}
            onPress={() => {
                // Optionally navigate to DeviceDetailsScreen, but for now just do nothing or expand
            }}
        />
    ), [])

    return (
        <StandardizedListLayout
            data={filteredDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            isLoading={loading}
            isFetching={loading}
            onRefresh={loadDevices}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search devices..."
            primaryActionLabel="Scan for Devices"
            onPrimaryAction={() => {}}
            emptyStateTitle="No devices found"
            emptyStateMessage={`There are no devices associated with ${projectName}.`}
            emptySearchMessage={`No devices found matching "${searchQuery}"`}
        />
    )
}
