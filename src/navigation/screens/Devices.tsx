import React, { useState, useEffect } from 'react'
import { View, FlatList, StyleSheet, Alert } from 'react-native'
import { FAB, Text, useTheme, ActivityIndicator, Button } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { DeviceCard } from '../../components/DeviceCard'
import { DeviceService } from '../../services/DeviceService'
import { DeviceListItem } from '../../types/device'
import { useNavigation } from '@react-navigation/native'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'

export const Devices = () => {
	const navigation = useNavigation()
	const theme = useTheme()
	const [devices, setDevices] = useState<DeviceListItem[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const loadDevices = async () => {
		try {
			const devicesList = await DeviceService.getDevicesAsListItems()
			setDevices(devicesList)
		} catch (error) {
			console.error('Error loading devices:', error)
			Alert.alert('Error', 'Failed to load devices')
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}

	useEffect(() => {
		loadDevices()
	}, [])

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

	// Loading state
	if (loading && !devices.length) {
		return (
			<WWScreenView scrollable={false}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" />
					<Text
						variant="bodyMedium"
						style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}
					>
						Loading devices...
					</Text>
				</View>
			</WWScreenView>
		)
	}

	// Empty state
	if (!devices || devices.length === 0) {
		return (
			<WWScreenView scrollable={false}>
				<OfflineIndicator />
				<View style={styles.centerContainer}>
					<Text
						variant="headlineSmall"
						style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
					>
						No devices yet
					</Text>
					<Text
						variant="bodyMedium"
						style={[styles.emptyMessage, { color: theme.colors.onSurfaceVariant }]}
					>
						Prepare and test nearby cameras to add them to your device list
					</Text>
					<Button
						mode="contained"
						icon="camera"
						onPress={handlePrepareAndTest}
						style={styles.createButton}
					>
						Prepare & Test Devices
					</Button>
					<Button
						mode="outlined"
						icon="wrench"
						onPress={handleEngineerConsole}
						style={styles.createButton}
					>
						Engineer Nearby Devices
					</Button>
				</View>
			</WWScreenView>
		)
	}

	return (
		<View style={styles.container}>
			<OfflineIndicator />

			<FlatList
				data={devices}
				renderItem={({ item }) => (
					<DeviceCard
						device={item}
						onPress={() => handleDevicePress(item.id)}
					/>
				)}
				keyExtractor={item => item.id}
				contentContainerStyle={styles.listContent}
				refreshing={refreshing}
				onRefresh={handleRefresh}
			/>

			{/* Floating Action Buttons */}
			<FAB
				icon="wrench"
				style={[styles.fabSecondary, { backgroundColor: theme.colors.secondary }]}
				onPress={handleEngineerConsole}
				label="Engineer Console"
				variant="secondary"
			/>
			<FAB
				icon="check-circle"
				style={[styles.fab, { backgroundColor: theme.colors.primary }]}
				onPress={handlePrepareAndTest}
				label="Prepare & Test"
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContent: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		paddingBottom: 150, // Space for FABs
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 32,
	},
	loadingText: {
		marginTop: 16,
	},
	emptyTitle: {
		marginBottom: 8,
		textAlign: 'center',
		fontWeight: '600',
	},
	emptyMessage: {
		marginBottom: 24,
		textAlign: 'center',
		maxWidth: 280,
	},
	createButton: {
		marginTop: 8,
	},
	fab: {
		position: 'absolute',
		margin: 16,
		right: 0,
		bottom: 0,
	},
	fabSecondary: {
		position: 'absolute',
		margin: 16,
		right: 0,
		bottom: 70, // Stack above primary FAB
	},
})
