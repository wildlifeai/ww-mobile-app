import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { useTheme } from 'react-native-paper'
import { DeviceCard } from '../../components/DeviceCard'
import { DeviceService } from '../../services/DeviceService'
import { DeviceListItem } from '../../types/device'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { RootState } from '../../redux'
import { StandardizedListLayout } from '../../components/ui/StandardizedListLayout'
import { log, logError } from '../../utils/logger'

export const Devices = () => {
	const theme = useTheme()
	const navigation = useNavigation()
	const [devices, setDevices] = useState<DeviceListItem[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')

	// Get current user ID from Redux
	const userId = useSelector((state: RootState) => state.authentication.user?.id)
	const isGlobalSyncing = useSelector((state: RootState) => state.sync.isGlobalSyncing)

	const loadDevices = useCallback(async () => {
		try {
			if (!userId) {
				log('No user ID available, cannot load devices')
				setDevices([])
				return
			}

			// Use filtered method to get only devices user has access to
			const devicesList = await DeviceService.getDevicesForUser(userId)

			// Sort by latest activity (maximum of preparedDate and lastDeploymentDate)
			const sortedDevices = [...devicesList].sort((a, b) => {
				const timeA = Math.max(
					a.preparedDate ? new Date(a.preparedDate).getTime() : 0,
					a.lastDeploymentDate ? new Date(a.lastDeploymentDate).getTime() : 0
				)
				const timeB = Math.max(
					b.preparedDate ? new Date(b.preparedDate).getTime() : 0,
					b.lastDeploymentDate ? new Date(b.lastDeploymentDate).getTime() : 0
				)
				return timeB - timeA
			})

			setDevices(sortedDevices)
		} catch (error) {
			logError('Error loading devices:', error)
			Alert.alert('Error', 'Failed to load devices')
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [userId])

	useFocusEffect(
		useCallback(() => {
			loadDevices()
		}, [loadDevices])
	)

	// Reload devices when global sync finishes
	useEffect(() => {
		if (!isGlobalSyncing) {
			loadDevices()
		}
	}, [isGlobalSyncing, loadDevices])

	const handleRefresh = () => {
		setRefreshing(true)
		loadDevices()
	}

	const handleDevicePress = (deviceId: string) => {
		(navigation as any).navigate('DeviceDetails', { deviceId })
	}

	const handlePrepareAndTest = () => {
		(navigation as any).navigate('DeviceDiscovery', { mode: 'prepare' })
	}

	const handleEngineerConsole = () => {
		(navigation as any).navigate('DeviceDiscovery', { mode: 'engineer' })
	}

	// Filter devices locally since we load all at once
	const filteredDevices = devices.filter(device =>
		!searchQuery ||
		device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
		device.bluetoothId?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	return (
		<StandardizedListLayout
			data={filteredDevices}
			renderItem={({ item }) => (
				<DeviceCard device={item} onPress={() => handleDevicePress(item.id)} />
			)}
			keyExtractor={(item) => item.id}
			isLoading={loading || (isGlobalSyncing && devices.length === 0)}
			isFetching={refreshing || isGlobalSyncing}
			onRefresh={handleRefresh}
			searchQuery={searchQuery}
			onSearchChange={setSearchQuery}
			searchPlaceholder="Search devices..."

			// Primary Action: Prepare & Test
			primaryActionLabel="Prepare & Test Devices"
			onPrimaryAction={handlePrepareAndTest}

			// Secondary Action: Engineer Console
			secondaryActionLabel="Engineer Device"
			onSecondaryAction={handleEngineerConsole}
			secondaryActionIcon="wrench"
			secondaryActionColor={theme.colors.primary}

			emptyStateTitle="No devices yet"
			emptyStateMessage="Prepare and test nearby cameras to add them to your device list"
			emptySearchMessage={`No devices found matching "${searchQuery}"`}
		/>
	)
}
