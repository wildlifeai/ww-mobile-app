import NetInfo, { NetInfoState } from "@react-native-community/netinfo"
import { DatabaseService } from "./DatabaseService"
import {
	ConflictResolutionService,
	getConflictResolutionService,
} from "./ConflictResolutionService"
import {
	UserRole,
	OfflineOperation,
	NetworkStatus,
	OfflineOperationType,
	LoRaWANStatus,
	User,
	ConflictResolution,
} from "../../types/offline"
import { OfflineApiService } from "./OfflineApiService"
import {
	ProjectCreate,
	ProjectUpdate,
	DeploymentCreate,
	DeploymentUpdate,
} from "../../types/api.types"

/**
 * OfflineService - Comprehensive offline-first service layer with organisation-aware operations
 *
 * Features:
 * - Network state monitoring with organisation priority handling
 * - Role-based sync filtering (ww_admin, project_admin, project_member)
 * - Operation queuing with organisation scoping and retry logic
 * - LoRaWAN status integration with offline caching
 * - Conflict detection foundation for data integrity
 * - Organisation data isolation and role validation
 */
export class OfflineService {
	private databaseService: DatabaseService
	private conflictResolutionService: ConflictResolutionService
	private networkStatus: NetworkStatus
	private networkUnsubscribe?: () => void
	private initialized = false

	// Retry configuration
	private readonly MAX_RETRY_ATTEMPTS = 5
	private readonly BASE_RETRY_DELAY = 1000 // 1 second
	private readonly MAX_RETRY_DELAY = 30000 // 30 seconds

	constructor() {
		this.databaseService = new DatabaseService()
		this.conflictResolutionService = getConflictResolutionService(
			this.databaseService,
		)
		this.networkStatus = {
			isConnected: false,
			type: "none",
		}
	}

	/**
	 * Initialize the offline service with database and network monitoring
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return

		// Initialize database connection
		await this.databaseService.initializeDatabase()

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
					console.log("📡 Triggering automatic sync...")
					this.syncPendingOperations().catch((error) => {
						console.error("📡 ❌ Failed to sync pending operations:", error)
					})
				} else if (!wasOffline && !isNowOnline) {
					console.log("📡 📴 TRANSITIONING FROM ONLINE → OFFLINE")
				} else {
					console.log(
						"📡 ℹ️ Network state change but no offline/online transition",
					)
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

	/**
	 * Set network status (primarily for testing)
	 */
	setNetworkStatus(status: NetworkStatus): void {
		this.networkStatus = status
	}

	/**
	 * Queue an operation for offline processing
	 * If online, attempt immediate execution
	 */
	async queueOperation(operation: OfflineOperation): Promise<void> {
		console.log(
			`📤 Queue operation called: ${operation.type} (id: ${operation.id})`,
		)
		console.log(
			`📤 Network status: ${
				this.networkStatus.isConnected ? "ONLINE" : "OFFLINE"
			}`,
		)

		if (this.networkStatus.isConnected) {
			// Attempt immediate execution if online
			console.log("📤 Attempting immediate execution (online)...")
			try {
				const success = await this.executeOperation(operation)
				if (success) {
					console.log("📤 ✅ Operation completed successfully, not queuing")
					return // Operation completed successfully
				}
				console.log("📤 ⚠️ Operation failed, will queue for retry")
			} catch (error) {
				console.warn(
					"📤 ❌ Failed to execute operation immediately, queuing for retry:",
					error,
				)
			}
		}

		// Queue operation for offline processing or retry
		const queueItem: any = {
			id: operation.id,
			operation_type: operation.type, // Map 'type' to 'operation_type' for database
			data: JSON.stringify(operation.data),
			user_id: operation.user_id,
			organisation_id: operation.organisation_id,
			priority: "medium", // Default priority
			retry_count: operation.retry_count,
			max_retries: 3, // Default max retries
			status: "pending",
		}

		console.log("📤 Adding to offline queue:", {
			id: queueItem.id,
			type: queueItem.operation_type,
			org_id: queueItem.organisation_id,
		})

		await this.databaseService.addToOfflineQueue(queueItem)
		console.log("📤 ✅ Successfully added to queue")
	}

	/**
	 * Execute a single offline operation
	 */
	async executeOperation(operation: OfflineOperation): Promise<boolean> {
		console.log(
			`⚙️ Executing operation ${operation.id} (type: ${operation.type})`,
		)

		try {
			switch (operation.type) {
				case "CREATE_PROJECT":
					console.log("⚙️ Calling executeCreateProject...")
					await this.executeCreateProject(operation)
					break
				case "UPDATE_PROJECT":
					console.log("⚙️ Calling executeUpdateProject...")
					await this.executeUpdateProject(operation)
					break
				case "DELETE_PROJECT":
					console.log("⚙️ Calling executeDeleteProject...")
					await this.executeDeleteProject(operation)
					break
				case "CREATE_DEPLOYMENT":
					console.log("⚙️ Calling executeCreateDeployment...")
					await this.executeCreateDeployment(operation)
					break
				case "UPDATE_DEPLOYMENT":
					console.log("⚙️ Calling executeUpdateDeployment...")
					await this.executeUpdateDeployment(operation)
					break
				case "DELETE_DEPLOYMENT":
					console.log("⚙️ Calling executeDeleteDeployment...")
					await this.executeDeleteDeployment(operation)
					break
				case "UPDATE_DEVICE_LORAWAN_STATUS":
					console.log("⚙️ Calling executeUpdateDeviceLoRaWANStatus...")
					await this.executeUpdateDeviceLoRaWANStatus(operation)
					break
				default:
					console.warn(`⚙️ ❌ Unknown operation type: ${operation.type}`)
					return false
			}

			// Remove successful operation from queue
			console.log(
				`⚙️ ✅ Operation ${operation.id} completed, removing from queue`,
			)
			await this.databaseService.markQueueItemCompleted(operation.id)
			return true
		} catch (error) {
			console.error(`⚙️ ❌ Failed to execute operation ${operation.id}:`, error)

			// Update retry count and requeue if within limits
			if (this.shouldRetryOperation(operation)) {
				console.log(
					`⚙️ ⏱️ Updating retry count for operation ${operation.id} (retry ${
						operation.retry_count + 1
					})`,
				)
				// Update retry count in queue
				await this.databaseService.updateQueueItemRetry(
					operation.id,
					operation.retry_count + 1,
					"pending",
				)
			} else {
				console.log(`⚙️ ❌ Max retries exceeded for operation ${operation.id}`)
			}

			return false
		}
	}

	/**
	 * Sync all pending operations based on user role
	 */
	async syncPendingOperations(user?: User): Promise<void> {
		console.log("🔄 ============ SYNC PENDING OPERATIONS START ============")
		console.log("🔄 Network connected:", this.networkStatus.isConnected)
		console.log("🔄 User role:", user?.role || "NO USER")

		if (!this.networkStatus.isConnected) {
			console.log("🔄 ❌ Sync aborted - network not connected")
			return
		}

		try {
			const operations = await this.getOperationsForSync(user)
			console.log(`🔄 Found ${operations.length} operations to sync`)

			if (operations.length === 0) {
				console.log("🔄 ✅ No operations to sync - queue is empty")
				return
			}

			console.log(
				"🔄 Operations to process:",
				operations.map((op) => ({
					id: op.id,
					type: op.type,
					retry_count: op.retry_count,
					organisation_id: op.organisation_id,
				})),
			)

			let processedCount = 0
			let skippedCount = 0
			let failedCount = 0

			for (const operation of operations) {
				console.log(
					`🔄 Processing operation ${operation.id} (type: ${operation.type})`,
				)

				if (user && !this.canUserPerformOperation(user, operation)) {
					console.warn(
						`🔄 ⚠️ User ${user.id} cannot perform operation ${operation.id}, skipping`,
					)
					skippedCount++
					continue
				}

				// Check if operation needs retry delay
				if (!this.isOperationReadyForRetry(operation)) {
					console.log(`🔄 ⏱️ Operation ${operation.id} not ready for retry yet`)
					skippedCount++
					continue
				}

				const success = await this.executeOperation(operation)
				if (success) {
					console.log(`🔄 ✅ Operation ${operation.id} executed successfully`)
					processedCount++
				} else {
					console.log(`🔄 ❌ Operation ${operation.id} failed`)
					failedCount++
				}
			}

			console.log(
				"🔄 ============ SYNC PENDING OPERATIONS COMPLETE ============",
			)
			console.log(
				`🔄 Processed: ${processedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
			)
		} catch (error) {
			console.error("🔄 ❌ Failed to sync pending operations:", error)
		}
	}

	/**
	 * Get operations for sync based on user role
	 */
	async getOperationsForSync(user?: User): Promise<OfflineOperation[]> {
		let queueItems: any[]

		if (!user) {
			queueItems = await this.databaseService.getPendingQueueItems()
		} else {
			switch (user.role) {
				case "ww_admin":
					// WW Admin can sync all organisations
					queueItems = await this.databaseService.getPendingQueueItems()
					break

				case "project_admin":
				case "project_member":
					// Organisation-scoped operations only
					queueItems = await this.databaseService.getQueueItemsByOrganisation(
						user.organisation_id,
					)
					break

				default:
					queueItems = []
			}
		}

		// Convert queue items to operations
		return queueItems.map((item) => ({
			id: item.id,
			type: item.operation_type, // Fix: Database uses 'operation_type' not 'type'
			data: typeof item.data === "string" ? JSON.parse(item.data) : item.data,
			user_id: item.user_id,
			organisation_id: item.organisation_id,
			timestamp: new Date(item.created_at || item.timestamp),
			retry_count: item.retry_count,
		}))
	}

	/**
	 * Check if user can perform a specific operation (role-based validation)
	 */
	canUserPerformOperation(user: User, operation: OfflineOperation): boolean {
		// WW Admin can perform any operation
		if (user.role === "ww_admin") {
			return true
		}

		// Check organisation boundaries for non-admin users
		if (operation.organisation_id !== user.organisation_id) {
			return false
		}

		// Role-specific operation validation
		switch (user.role) {
			case "project_admin":
				// Project admin can perform most operations within their organisation
				return this.isProjectAdminOperation(operation.type)

			case "project_member":
				// Project member has limited operations
				return this.isProjectMemberOperation(operation.type)

			default:
				return false
		}
	}

	/**
	 * Check if operation is allowed for project_admin role
	 */
	private isProjectAdminOperation(
		operationType: OfflineOperationType,
	): boolean {
		const allowedOperations: OfflineOperationType[] = [
			"CREATE_PROJECT",
			"UPDATE_PROJECT",
			"DELETE_PROJECT",
			"CREATE_DEPLOYMENT",
			"UPDATE_DEPLOYMENT",
			"DELETE_DEPLOYMENT",
			"UPDATE_DEVICE_LORAWAN_STATUS",
		]
		return allowedOperations.includes(operationType)
	}

	/**
	 * Check if operation is allowed for project_member role
	 */
	private isProjectMemberOperation(
		operationType: OfflineOperationType,
	): boolean {
		const allowedOperations: OfflineOperationType[] = [
			"CREATE_DEPLOYMENT",
			"UPDATE_DEPLOYMENT",
			"UPDATE_DEVICE_LORAWAN_STATUS",
		]
		return allowedOperations.includes(operationType)
	}

	/**
	 * Update LoRaWAN device status with offline caching
	 */
	async updateDeviceLoRaWANStatus(
		deviceId: string,
		status: LoRaWANStatus,
		deploymentId?: string,
	): Promise<void> {
		// Always cache status locally for offline access (if we have deployment ID)
		if (deploymentId) {
			await this.databaseService.updateDeploymentLoRaWANStatus(
				deploymentId,
				status,
			)
		}

		// If offline, queue the update for sync
		if (!this.networkStatus.isConnected) {
			const operation: OfflineOperation = {
				id: `lorawan-update-${deviceId}-${Date.now()}`,
				type: "UPDATE_DEVICE_LORAWAN_STATUS",
				data: { device_id: deviceId, status, deployment_id: deploymentId },
				user_id: "", // Will be set by caller
				organisation_id: "", // Will be set by caller
				timestamp: new Date(),
				retry_count: 0,
			}

			await this.queueOperation(operation)
		}
	}

	/**
	 * Detect potential conflicts between server and local data
	 * @deprecated Use conflictResolutionService.detectConflicts instead
	 */
	detectPotentialConflict(serverData: any, localData: any): boolean {
		if (!serverData.updated_at || !localData.updated_at) {
			return false // Cannot detect conflicts without timestamps
		}

		const serverTime = new Date(serverData.updated_at)
		const localTime = new Date(localData.updated_at)

		// Conflict if times differ (server and local modifications)
		return serverTime.getTime() !== localTime.getTime()
	}

	/**
	 * Prepare conflict data for resolution
	 * @deprecated Use conflictResolutionService.detectConflicts instead
	 */
	prepareConflictResolution(
		serverData: any,
		localData: any,
	): ConflictResolution {
		return {
			id: serverData.id || localData.id,
			server_version: serverData,
			local_version: localData,
			conflict_type: "data_modification",
			needs_user_resolution: true,
		}
	}

	/**
	 * Sync with conflict resolution support
	 */
	async syncWithConflictResolution(
		user: User,
		operationType: string,
		serverData: any,
		localData: any,
	): Promise<any> {
		try {
			// Detect conflicts using the advanced conflict resolution service
			const conflicts = await this.conflictResolutionService.detectConflicts(
				serverData,
				localData,
				operationType,
				user,
			)

			if (conflicts.length === 0) {
				// No conflicts, return server data
				return serverData
			}

			// Resolve conflicts
			const resolvedData =
				await this.conflictResolutionService.resolveConflicts(conflicts)

			// Return the first resolved item (there should only be one for a single data sync)
			return resolvedData[0] || serverData
		} catch (error) {
			console.error("Failed to resolve conflicts:", error)
			// Fallback to server wins strategy
			return serverData
		}
	}

	/**
	 * Get pending conflicts that need user resolution
	 */
	async getPendingConflicts(): Promise<ConflictResolution[]> {
		try {
			return await this.databaseService.getPendingConflicts()
		} catch (error) {
			console.error("Failed to get pending conflicts:", error)
			return []
		}
	}

	/**
	 * Resolve a specific conflict with user choice
	 */
	async resolveConflictWithUserChoice(
		conflictId: string,
		strategy: "server_wins" | "local_wins" | "merge",
	): Promise<boolean> {
		try {
			// Get the conflict
			const conflicts = await this.conflictResolutionService.getConflictHistory(
				conflictId,
			)

			if (conflicts.length === 0) {
				console.warn(`Conflict ${conflictId} not found`)
				return false
			}

			const conflict = conflicts[0]

			// Create a new conflict resolution with user's choice
			const conflictResolution: ConflictResolution = {
				id: conflict.id,
				server_version: conflict.server_data,
				local_version: conflict.local_data,
				conflict_type: conflict.conflict_type,
				needs_user_resolution: false,
				resolution_strategy: strategy,
				resolved_at: new Date(),
			}

			// Resolve using the specified strategy
			await this.conflictResolutionService.resolveConflicts(
				[conflictResolution],
				strategy,
			)

			return true
		} catch (error) {
			console.error("Failed to resolve conflict with user choice:", error)
			return false
		}
	}

	/**
	 * Get conflict resolution history for debugging
	 */
	async getConflictHistory(entityId?: string): Promise<any[]> {
		return await this.conflictResolutionService.getConflictHistory(entityId)
	}

	/**
	 * Clean up old resolved conflicts
	 */
	async cleanupOldConflicts(daysOld: number = 30): Promise<void> {
		return await this.conflictResolutionService.cleanupOldConflicts(daysOld)
	}

	/**
	 * Calculate retry delay with exponential backoff
	 */
	calculateRetryDelay(retryCount: number): number {
		const delay = Math.min(
			this.BASE_RETRY_DELAY * Math.pow(2, retryCount),
			this.MAX_RETRY_DELAY,
		)
		return delay
	}

	/**
	 * Check if operation should be retried
	 */
	shouldRetryOperation(operation: OfflineOperation): boolean {
		return operation.retry_count < this.MAX_RETRY_ATTEMPTS
	}

	/**
	 * Check if operation is ready for retry based on backoff delay
	 */
	private isOperationReadyForRetry(operation: OfflineOperation): boolean {
		if (operation.retry_count === 0) return true

		const retryDelay = this.calculateRetryDelay(operation.retry_count)
		const timeSinceLastAttempt = Date.now() - operation.timestamp.getTime()

		return timeSinceLastAttempt >= retryDelay
	}

	// Operation execution methods
	private async executeCreateProject(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const projectData = operation.data as ProjectCreate

			// Execute API call through OfflineApiService
			const result = await OfflineApiService.createProject(projectData)

			console.log("CREATE_PROJECT successful:", result.id)

			// Update local database with server response
			// Note: Project already exists locally (created optimistically), so UPDATE not INSERT
			const dbProject = {
				name: result.name || projectData.name,
				description: result.description || projectData.description || "",
				// Note: 'status' and 'members' are not properties in database types - removed
			}

			await this.databaseService.updateProject(result.id, dbProject)
		} catch (error) {
			console.error("Failed to execute CREATE_PROJECT:", error)
			throw error // Re-throw to trigger retry logic
		}
	}

	private async executeUpdateProject(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const { id, ...updateData } = operation.data as ProjectUpdate & {
				id: string
			}

			// Execute API call through OfflineApiService
			const result = await OfflineApiService.updateProject(id, updateData)

			console.log("UPDATE_PROJECT successful:", result.id)

			// Update local database with server response
			const dbProject = {
				id: result.id,
				organisation_id: operation.organisation_id,
				name: result.name || updateData.name,
				description: result.description || updateData.description || "",
				// Note: 'status' and 'members' are not properties in database types - removed
			}

			await this.databaseService.updateProject(id, dbProject)
		} catch (error) {
			console.error("Failed to execute UPDATE_PROJECT:", error)
			throw error
		}
	}

	private async executeDeleteProject(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const { id } = operation.data as { id: string }

			// Execute API call through OfflineApiService
			await OfflineApiService.deleteProject(id)

			console.log("DELETE_PROJECT successful:", id)

			// Remove from local database
			await this.databaseService.deleteProject(id)
		} catch (error) {
			console.error("Failed to execute DELETE_PROJECT:", error)
			throw error
		}
	}

	private async executeCreateDeployment(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const deploymentData = operation.data as DeploymentCreate

			// Execute API call through OfflineApiService
			const result = await OfflineApiService.createDeployment(deploymentData)

			console.log("CREATE_DEPLOYMENT successful:", result.id)

			// Update local database with server response
			const dbDeployment = {
				id: result.id,
				project_id: result.project_id || deploymentData.project_id,
				organisation_id: operation.organisation_id,
				device_id: result.device_id || deploymentData.device_id,
				location: result.location ||
					deploymentData.location || { lat: 0, lng: 0 },
				// Note: 'status' and 'lorawan_status' are not properties in Supabase database types - removed
			}

			await this.databaseService.insertDeployment(dbDeployment)
		} catch (error) {
			console.error("Failed to execute CREATE_DEPLOYMENT:", error)
			throw error
		}
	}

	private async executeUpdateDeployment(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const { id, ...updateData } = operation.data as DeploymentUpdate & {
				id: string
			}

			// Execute API call through OfflineApiService
			const result = await OfflineApiService.updateDeployment(id, updateData)

			console.log("UPDATE_DEPLOYMENT successful:", result.id)

			// Update local database with server response
			const dbDeployment = {
				id: result.id,
				project_id: result.project_id || updateData.project_id,
				organisation_id: operation.organisation_id,
				device_id: result.device_id || updateData.device_id,
				location: result.location || updateData.location || { lat: 0, lng: 0 },
				// Note: 'status' and 'lorawan_status' are not properties in Supabase database types - removed
			}

			await this.databaseService.updateDeployment(id, dbDeployment)
		} catch (error) {
			console.error("Failed to execute UPDATE_DEPLOYMENT:", error)
			throw error
		}
	}

	private async executeDeleteDeployment(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const { id } = operation.data as { id: string }

			// Execute API call through OfflineApiService
			await OfflineApiService.deleteDeployment(id)

			console.log("DELETE_DEPLOYMENT successful:", id)

			// Remove from local database
			await this.databaseService.deleteDeployment(id)
		} catch (error) {
			console.error("Failed to execute DELETE_DEPLOYMENT:", error)
			throw error
		}
	}

	private async executeUpdateDeviceLoRaWANStatus(
		operation: OfflineOperation,
	): Promise<void> {
		try {
			const { device_id, status, deployment_id } = operation.data as {
				device_id: string
				status: LoRaWANStatus
				deployment_id?: string
			}

			// If we have a deployment_id, update the deployment with LoRaWAN status
			if (deployment_id) {
				await OfflineApiService.updateDeployment(deployment_id, {
					lorawan_status: status,
				})

				console.log("UPDATE_DEVICE_LORAWAN_STATUS successful:", device_id)

				// Update local database
				await this.databaseService.updateDeploymentLoRaWANStatus(
					deployment_id,
					status,
				)
			} else {
				// Direct device status update - implement based on your device API
				console.log(
					"Updating device LoRaWAN status directly:",
					device_id,
					status,
				)
				// TODO: Implement direct device API call when available
			}
		} catch (error) {
			console.error("Failed to execute UPDATE_DEVICE_LORAWAN_STATUS:", error)
			throw error
		}
	}

	// Advanced Sync Operations (Task 11.5 Requirements)

	/**
	 * Batch sync operations for efficient data transfer
	 */
	async batchSyncOperations(
		operations: OfflineOperation[],
		batchSize: number = 10,
	): Promise<{ successful: number; failed: number }> {
		if (!this.networkStatus.isConnected) {
			throw new Error("Network connection required for batch sync")
		}

		let successful = 0
		let failed = 0

		// Process operations in batches to avoid overwhelming the server
		for (let i = 0; i < operations.length; i += batchSize) {
			const batch = operations.slice(i, i + batchSize)

			// Execute batch operations in parallel
			const batchPromises = batch.map(async (operation) => {
				try {
					await this.executeOperation(operation)
					successful++
				} catch (error) {
					console.error(`Batch operation failed: ${operation.id}`, error)
					failed++
				}
			})

			await Promise.allSettled(batchPromises)

			// Small delay between batches to prevent server overload
			if (i + batchSize < operations.length) {
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
		}

		return { successful, failed }
	}

	/**
	 * Incremental sync based on timestamps
	 */
	async incrementalSync(
		user: User,
		lastSyncTimestamp?: Date,
	): Promise<{ synced: number; conflicts: number }> {
		if (!this.networkStatus.isConnected) {
			throw new Error("Network connection required for incremental sync")
		}

		try {
			// Get operations modified since last sync
			const operations = await this.getOperationsSince(user, lastSyncTimestamp)

			let synced = 0
			let conflicts = 0

			for (const operation of operations) {
				try {
					// Check for conflicts before executing
					const hasConflicts = await this.checkForConflicts(operation)

					if (hasConflicts) {
						conflicts++
						// Handle conflict through conflict resolution service
						await this.handleOperationConflict(operation, user)
					} else {
						await this.executeOperation(operation)
						synced++
					}
				} catch (error) {
					console.error(
						`Incremental sync failed for operation ${operation.id}:`,
						error,
					)
				}
			}

			return { synced, conflicts }
		} catch (error) {
			console.error("Incremental sync failed:", error)
			throw error
		}
	}

	/**
	 * Selective sync based on operation types and user preferences
	 */
	async selectiveSync(
		user: User,
		operationTypes: OfflineOperationType[],
		priority: "low" | "normal" | "high" | "critical" = "normal",
	): Promise<number> {
		if (!this.networkStatus.isConnected) {
			throw new Error("Network connection required for selective sync")
		}

		try {
			// Get operations matching the specified types and priority
			const operations = await this.getOperationsByTypeAndPriority(
				user,
				operationTypes,
				priority,
			)

			let syncedCount = 0

			for (const operation of operations) {
				try {
					await this.executeOperation(operation)
					syncedCount++
				} catch (error) {
					console.error(
						`Selective sync failed for operation ${operation.id}:`,
						error,
					)
				}
			}

			return syncedCount
		} catch (error) {
			console.error("Selective sync failed:", error)
			throw error
		}
	}

	// Helper methods for advanced sync operations

	private async getOperationsSince(
		user: User,
		timestamp?: Date,
	): Promise<OfflineOperation[]> {
		const queueItems = await this.databaseService.getQueueItemsSince(
			user.organisation_id,
			timestamp?.toISOString(),
		)

		return queueItems.map((item) => ({
			id: item.id,
			type: item.type,
			data: JSON.parse(item.data),
			user_id: item.user_id,
			organisation_id: item.organisation_id,
			timestamp: new Date(item.timestamp),
			retry_count: item.retry_count,
		}))
	}

	private async getOperationsByTypeAndPriority(
		user: User,
		operationTypes: OfflineOperationType[],
		priority: string,
	): Promise<OfflineOperation[]> {
		const queueItems =
			await this.databaseService.getQueueItemsByTypeAndPriority(
				user.organisation_id,
				operationTypes,
				priority,
			)

		return queueItems.map((item) => ({
			id: item.id,
			type: item.type,
			data: JSON.parse(item.data),
			user_id: item.user_id,
			organisation_id: item.organisation_id,
			timestamp: new Date(item.timestamp),
			retry_count: item.retry_count,
		}))
	}

	private async checkForConflicts(
		operation: OfflineOperation,
	): Promise<boolean> {
		// Basic conflict detection - can be enhanced based on operation type
		try {
			// For data modification operations, check if server data has changed
			if (["UPDATE_PROJECT", "UPDATE_DEPLOYMENT"].includes(operation.type)) {
				// This would typically involve fetching current server state
				// and comparing with local operation data
				return false // Simplified for now
			}
			return false
		} catch (error) {
			console.error("Conflict check failed:", error)
			return true // Assume conflict on error for safety
		}
	}

	private async handleOperationConflict(
		operation: OfflineOperation,
		user: User,
	): Promise<void> {
		try {
			// Use the conflict resolution service to handle the conflict
			const serverData = await this.fetchServerData(operation)
			const localData = operation.data

			const conflicts = await this.conflictResolutionService.detectConflicts(
				serverData,
				localData,
				operation.type,
				user,
			)

			if (conflicts.length > 0) {
				// For now, resolve with server wins strategy
				// In production, this could trigger UI for user choice
				await this.conflictResolutionService.resolveConflicts(
					conflicts,
					"server_wins",
				)
			}
		} catch (error) {
			console.error("Failed to handle operation conflict:", error)
			throw error
		}
	}

	private async fetchServerData(operation: OfflineOperation): Promise<any> {
		// Fetch current server state based on operation type
		// This is a simplified implementation - would need proper API calls
		try {
			switch (operation.type) {
				case "UPDATE_PROJECT":
					return await OfflineApiService.getProject(operation.data.id)
				case "UPDATE_DEPLOYMENT":
					return await OfflineApiService.getDeployment(operation.data.id)
				default:
					return null
			}
		} catch (error) {
			console.error("Failed to fetch server data:", error)
			return null
		}
	}

	/**
	 * Clean up resources
	 */
	async destroy(): Promise<void> {
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe()
			this.networkUnsubscribe = undefined
		}

		this.initialized = false
	}
}
