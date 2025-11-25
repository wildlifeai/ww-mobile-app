import NetInfo, { NetInfoState } from "@react-native-community/netinfo"
import { NetworkStatus } from "../../types/offline"
import SupabaseSyncService from "../SupabaseSyncService"

/**
 * OfflineService - Network status monitoring
 * 
 * Refactored for WatermelonDB Native Sync:
 * - Removed custom queue management (replaced by WatermelonDB Sync)
 * - Retained network monitoring to trigger syncs
 */
export class OfflineService {
	private networkStatus: NetworkStatus
	private networkUnsubscribe?: () => void
	private initialized = false

	constructor() {
		this.networkStatus = {
			isConnected: false,
			type: "none",
		}
	}

	/**
	 * Initialize the offline service with network monitoring
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		// Set up network monitoring
		await this.setupNetworkMonitoring()

		this.initialized = true
	}

	/**
	 * Set up network state monitoring and sync triggers
	 */
	private async setupNetworkMonitoring(): Promise<void> {
		// Get initial network state
		const initialState = await NetInfo.fetch()
		this.updateNetworkStatus(initialState)
		console.log("📡 Initial network state:", this.networkStatus)

		// Listen for network changes
		this.networkUnsubscribe = NetInfo.addEventListener(
			(state: NetInfoState) => {
				const wasOffline = !this.networkStatus.isConnected
				this.updateNetworkStatus(state)
				const isNowOnline = this.networkStatus.isConnected

				console.log("📡 ============ NETWORK STATE CHANGE ============")
				console.log("📡 Was offline:", wasOffline)
				console.log("📡 Is now online:", isNowOnline)
				console.log("📡 Network type:", this.networkStatus.type)

				// Trigger sync when coming online
				if (wasOffline && isNowOnline) {
					console.log("📡 🔄 TRANSITIONING FROM OFFLINE → ONLINE")
					console.log("📡 Triggering WatermelonDB sync...")
					SupabaseSyncService.sync().catch((error) => {
						console.error("📡 ❌ Failed to trigger sync:", error)
					})
				}
			},
		)
	}

	/**
	 * Update internal network status
	 */
	private updateNetworkStatus(state: NetInfoState): void {
		this.networkStatus = {
			isConnected: state.isConnected ?? false,
			type: state.type || "none",
		}
	}

	/**
	 * Get current network status
	 */
	getNetworkStatus(): NetworkStatus {
		return { ...this.networkStatus }
	}

	// Deprecated methods stubs to prevent immediate crashes if called, 
	// but they should be removed from callers.

	async queueOperation(operation: any): Promise<void> {
		console.warn("⚠️ queueOperation is deprecated. Use WatermelonDB models directly.")
	}
}

export default new OfflineService()
