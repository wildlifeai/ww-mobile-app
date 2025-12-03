import * as React from "react"
import { PropsWithChildren } from "react"

import { StyleSheet, View, Text, ActivityIndicator } from "react-native"

import Toast, {
	BaseToast,
	ErrorToast,
	InfoToast,
	SuccessToast,
	ToastConfigParams,
} from "react-native-toast-message"

import { useBluetoothStatus } from "../hooks/useBluetoothStatus"
import { useLocationStatus } from "../hooks/useLocationStatus"
import { useSetupBLELibrary } from "../hooks/useSetupBLELibrary"
import { useAppDispatch } from "../redux"

import ProjectService from "../services/ProjectService"
import ReferenceDataService from "../services/ReferenceDataService"
import { initializeSupabaseClient } from "../services/supabase"
import SupabaseSyncService from "../services/SupabaseSyncService"

interface ExtendedToastConfigParams extends ToastConfigParams<any> {
	numberOfLines?: number
}

/**
 * Sets up different listeners and a basic permission layer
 * so that the app can respond to system events.
 *
 * At the moment the BLE library is set up, bluetooth and
 * location service status is being tracked, closest
 * VSS servers are pulled via ICMP (ping).
 */
export const AppSetupProvider = ({ children }: PropsWithChildren<{}>) => {
	const dispatch = useAppDispatch()

	// Add loading state to wait for Supabase initialization
	const [isSupabaseReady, setIsSupabaseReady] = React.useState(false)

	useSetupBLELibrary()
	useBluetoothStatus()
	useLocationStatus()

	// Initialize Supabase client and then sync reference data
	React.useEffect(() => {
		console.log("🔧 Initializing Supabase client...")
		initializeSupabaseClient()
			.then(() => {
				console.log("✅ Supabase client initialized successfully")
				setIsSupabaseReady(true)  // Mark as ready

				// Sync reference data only after Supabase client is ready
				console.log("📚 Syncing reference data...")
				return ReferenceDataService.syncReferenceData()
			})
			.then(() => {
				console.log("✅ Reference data sync complete")
			})
			.catch((error) => {
				console.error("❌ Failed to initialize Supabase or sync data:", error)
				// Still mark as ready so app doesn't hang forever
				setIsSupabaseReady(true)
			})
	}, [])

	// Initialize Supabase Sync Service
	React.useEffect(() => {
		if (!isSupabaseReady) return  // Wait for Supabase

		console.log("🔄 Starting Supabase Sync Service...")
		SupabaseSyncService.resetSyncState().then(() => {
			SupabaseSyncService.startRealtimeSubscription()
			SupabaseSyncService.sync() // Initial sync
		})

		return () => {
			console.log("🛑 Stopping Supabase Sync Service...")
			SupabaseSyncService.stopRealtimeSubscription()
		}
	}, [isSupabaseReady])  // Depend on ready state

	// Show loading screen while initializing
	if (!isSupabaseReady) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
				<ActivityIndicator size="large" color="#2e7d32" />
				<Text style={{ marginTop: 16, fontSize: 16, color: '#333' }}>Initializing...</Text>
			</View>
		)
	}

	// Only render children after Supabase is ready
	return (
		<>
			{children}
			<Toast
				position="bottom"
				config={{
					base: createBaseToast,
					success: createSuccessToast,
					error: createErrorToast,
					info: createInfoToast,
				}}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	toast: { borderRadius: 0 },
	text: { fontSize: 14 },
	description: { fontSize: 12 },
})

const createBaseToast = (props: ExtendedToastConfigParams) => (
	<BaseToast
		{...props}
		style={[styles.toast]}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createSuccessToast = (props: ExtendedToastConfigParams) => (
	<SuccessToast
		{...props}
		style={[styles.toast]}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createInfoToast = (props: ExtendedToastConfigParams) => (
	<InfoToast
		{...props}
		style={[styles.toast]}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createErrorToast = (props: ExtendedToastConfigParams) => (
	<ErrorToast
		{...props}
		style={[styles.toast]}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)
