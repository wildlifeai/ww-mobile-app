import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { DeviceCard } from '../../components/DeviceCard'
import { DeviceService } from '../../services/DeviceService'
import { DeviceListItem } from '../../types/device'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { RootState } from '../../redux'
import { StandardizedListLayout } from '../../components/ui/StandardizedListLayout'
import { log, logError } from '../../utils/logger'
import SupabaseSyncService from '../../services/SupabaseSyncService'

export const Devices = () => {
	const navigation = useNavigation()
	const [devices, setDevices] = useState<DeviceListItem[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')

	// Get current user ID and organisation from Redux
	const userId = useSelector((state: RootState) => state.authentication.user?.id)
	const currentOrganisation = useSelector((state: RootState) => state.authentication.currentOrganisation)
	const organisationId = currentOrganisation?.id
	const organisationName = currentOrganisation?.name || 'your organisation'
	const hasMultipleOrgs = (useSelector((state: RootState) => state.authentication.user?.organisations)?.length ?? 0) > 1
	const isGlobalSyncing = useSelector((state: RootState) => state.sync.isGlobalSyncing)

	const loadDevices = useCallback(async () => {
		try {
			if (!userId) {
				log('No user ID available, cannot load devices')
				setDevices([])
				return
			}

			// Use filtered method to get only devices user has access to within the selected org
			const devicesList = organisationId
				? await DeviceService.getDevicesForUserInOrganisation(userId, organisationId)
				: await DeviceService.getDevicesForUser(userId)

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
	}, [userId, organisationId])

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

	const handleRefresh = async () => {
		setRefreshing(true)
		try {
			log('[DevicesListScreen] Syncing devices manually...')
			await SupabaseSyncService.sync()
		} catch (error) {
			logError('Error syncing devices:', error)
		} finally {
			setRefreshing(false)
		}
	}

	const handleDevicePress = useCallback((deviceId: string) => {
		(navigation as any).navigate('DeviceDetails', { deviceId })
	}, [navigation])

	const handlePrepareAndTest = () => {
		(navigation as any).navigate('DeviceDiscovery', { mode: 'prepare' })
	}

	// Filter devices locally since we load all at once
	const filteredDevices = devices.filter(device =>
		!searchQuery ||
		device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
		device.bluetoothId?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	const renderDeviceItem = useCallback(({ item }: { item: DeviceListItem }) => (
		<DeviceCard device={item} onPress={() => handleDevicePress(item.id)} />
	), [handleDevicePress])

	return (
		<StandardizedListLayout
			data={filteredDevices}
			renderItem={renderDeviceItem}
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

			emptyStateTitle={hasMultipleOrgs ? `No devices for ${organisationName}` : 'No devices yet'}
			emptyStateMessage={hasMultipleOrgs
				? `There are no devices yet for ${organisationName}. Prepare and test nearby cameras, or switch to a different organisation.`
				: 'Prepare and test nearby cameras to add them to your device list.'
			}
			emptySearchMessage={`No devices found matching "${searchQuery}"`}
		/>
	)
}
