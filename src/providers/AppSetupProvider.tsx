import * as React from "react"
import { PropsWithChildren } from "react"

import { StyleSheet } from "react-native"

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
import { initializeNetworkMonitoring } from "../redux/middleware/offlineSyncMiddleware"
import ProjectService from "../services/ProjectService"
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

	useSetupBLELibrary()
	useBluetoothStatus()
	useLocationStatus()

	// Initialize Supabase client with current environment
	React.useEffect(() => {
		console.log("🔧 Initializing Supabase client...")
		initializeSupabaseClient()
			.then(() => {
				console.log("✅ Supabase client initialized successfully")
			})
			.catch((error) => {
				console.error("❌ Failed to initialize Supabase client:", error)
			})
	}, [])

	// Initialize network monitoring for offline support
	React.useEffect(() => {
		console.log("🌐 Initializing network monitoring...")
		const unsubscribe = initializeNetworkMonitoring(dispatch)
		return () => {
			console.log("🌐 Cleaning up network monitoring")
			unsubscribe()
		}
	}, [dispatch])

	// Initialize ProjectService with DatabaseService and OfflineService
	React.useEffect(() => {
		console.log("📦 Initializing ProjectService...")
		ProjectService.initialize()
			.then(() => {
				console.log("✅ ProjectService initialized successfully")
			})
			.catch((error) => {
				console.error("❌ Failed to initialize ProjectService:", error)
			})
	}, [])

	// Initialize Supabase Sync Service
	React.useEffect(() => {
		console.log("🔄 Starting Supabase Sync Service...")
		SupabaseSyncService.startRealtimeSubscription()
		SupabaseSyncService.sync() // Initial sync

		return () => {
			console.log("🛑 Stopping Supabase Sync Service...")
			SupabaseSyncService.stopRealtimeSubscription()
		}
	}, [])

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
