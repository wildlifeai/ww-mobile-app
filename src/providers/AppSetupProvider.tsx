import { PropsWithChildren, useState, useEffect } from "react"

import { StyleSheet, View, Text, ActivityIndicator } from "react-native"

import Toast, {
	BaseToast,
	ErrorToast,
	InfoToast,
	SuccessToast,
	ToastConfigParams,
} from "react-native-toast-message"

import { useBluetoothStatus } from "../hooks/useBluetoothStatus"

import { useSetupBLELibrary } from "../hooks/useSetupBLELibrary"
import { useAppSelector } from "../redux"

import ReferenceDataService from "../services/ReferenceDataService"
import { initializeSupabaseClient } from "../services/supabase"
import SupabaseSyncService from "../services/SupabaseSyncService"
import { log, logError } from '../utils/logger'


interface ExtendedToastConfigParams extends ToastConfigParams<any> {
	numberOfLines?: number
}

export const AppSetupProvider = ({ children }: PropsWithChildren<{}>) => {
	const user = useAppSelector((state) => state.authentication.user)

	// Add loading state to wait for Supabase initialization
	const [isSupabaseReady, setIsSupabaseReady] = useState(false)

	useSetupBLELibrary()
	useBluetoothStatus()


	// Initialize Supabase client and then sync reference data
	useEffect(() => {
		log("🔧 Initializing Supabase client...")
		initializeSupabaseClient()
			.then(() => {
				log("✅ Supabase client initialized successfully")
				setIsSupabaseReady(true)  // Mark as ready

				// Sync reference data only after Supabase client is ready
				log("📚 Syncing reference data...")
				return ReferenceDataService.syncReferenceData()
			})
			.then(() => {
				log("✅ Reference data sync complete")
			})
			.catch((error) => {
				logError("❌ Failed to initialize Supabase or sync data:", error)
				// Still mark as ready so app doesn't hang forever
				setIsSupabaseReady(true)
			})
	}, [])

	// Initialize Supabase Sync Service
	useEffect(() => {
		if (!isSupabaseReady) return  // Wait for Supabase

		log("🔄 Starting Supabase Sync Service...")
		SupabaseSyncService.resetSyncState().then(() => {
			SupabaseSyncService.startRealtimeSubscription()
		})

		return () => {
			log("🛑 Stopping Supabase Sync Service...")
			SupabaseSyncService.stopRealtimeSubscription()
		}
	}, [isSupabaseReady])

	// Trigger Sync on Login
	useEffect(() => {
		if (isSupabaseReady && user?.id) {
			log("👤 User authenticated - triggering data sync...")
			SupabaseSyncService.sync()
		}
	}, [isSupabaseReady, user?.id]) // Depend strictly on user ID change

	// Show loading screen while initializing
	if (!isSupabaseReady) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#2e7d32" />
				<Text style={styles.loadingText}>Initializing...</Text>
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
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#ffffff',
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: '#333333',
	},
	toast: { borderRadius: 0 },
	text: { fontSize: 14 },
	description: { fontSize: 12 },
})

const createBaseToast = (props: ExtendedToastConfigParams) => (
	<BaseToast
		{...props}
		style={styles.toast}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createSuccessToast = (props: ExtendedToastConfigParams) => (
	<SuccessToast
		{...props}
		style={styles.toast}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createInfoToast = (props: ExtendedToastConfigParams) => (
	<InfoToast
		{...props}
		style={styles.toast}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)

const createErrorToast = (props: ExtendedToastConfigParams) => (
	<ErrorToast
		{...props}
		style={styles.toast}
		text1Style={styles.text}
		text2Style={styles.description}
		text2NumberOfLines={props.props.numberOfLines || 1}
	/>
)
