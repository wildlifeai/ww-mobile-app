import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { DatabaseService } from './DatabaseService';
import { 
  UserRole, 
  OfflineOperation, 
  NetworkStatus, 
  OfflineOperationType, 
  LoRaWANStatus,
  User,
  ConflictResolution 
} from '../../types/offline';

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
  private databaseService: DatabaseService;
  private networkStatus: NetworkStatus;
  private networkUnsubscribe?: () => void;
  private initialized = false;

  // Retry configuration
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BASE_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

  constructor() {
    this.databaseService = new DatabaseService();
    this.networkStatus = {
      isConnected: false,
      type: 'none'
    };
  }

  /**
   * Initialize the offline service with database and network monitoring
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize database connection
    await this.databaseService.initializeDatabase();

    // Set up network monitoring
    await this.setupNetworkMonitoring();

    this.initialized = true;
  }

  /**
   * Set up network state monitoring and sync triggers
   */
  private async setupNetworkMonitoring(): Promise<void> {
    // Get initial network state
    const initialState = await NetInfo.fetch();
    this.updateNetworkStatus(initialState);

    // Listen for network changes
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.networkStatus.isConnected;
      this.updateNetworkStatus(state);
      const isNowOnline = this.networkStatus.isConnected;

      // Trigger sync when coming online
      if (wasOffline && isNowOnline) {
        this.syncPendingOperations().catch(error => {
          console.error('Failed to sync pending operations:', error);
        });
      }
    });
  }

  /**
   * Update internal network status
   */
  private updateNetworkStatus(state: NetInfoState): void {
    this.networkStatus = {
      isConnected: state.isConnected ?? false,
      type: state.type || 'none'
    };
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  /**
   * Set network status (primarily for testing)
   */
  setNetworkStatus(status: NetworkStatus): void {
    this.networkStatus = status;
  }

  /**
   * Queue an operation for offline processing
   * If online, attempt immediate execution
   */
  async queueOperation(operation: OfflineOperation): Promise<void> {
    if (this.networkStatus.isConnected) {
      // Attempt immediate execution if online
      try {
        const success = await this.executeOperation(operation);
        if (success) return; // Operation completed successfully
      } catch (error) {
        console.warn('Failed to execute operation immediately, queuing for retry:', error);
      }
    }

    // Queue operation for offline processing or retry
    const queueItem: any = {
      id: operation.id,
      type: operation.type,
      data: JSON.stringify(operation.data),
      user_id: operation.user_id,
      organisation_id: operation.organisation_id,
      timestamp: operation.timestamp,
      retry_count: operation.retry_count,
      status: 'pending'
    };
    await this.databaseService.addToOfflineQueue(queueItem);
  }

  /**
   * Execute a single offline operation
   */
  async executeOperation(operation: OfflineOperation): Promise<boolean> {
    try {
      switch (operation.type) {
        case 'CREATE_PROJECT':
          await this.executeCreateProject(operation);
          break;
        case 'UPDATE_PROJECT':
          await this.executeUpdateProject(operation);
          break;
        case 'DELETE_PROJECT':
          await this.executeDeleteProject(operation);
          break;
        case 'CREATE_DEPLOYMENT':
          await this.executeCreateDeployment(operation);
          break;
        case 'UPDATE_DEPLOYMENT':
          await this.executeUpdateDeployment(operation);
          break;
        case 'DELETE_DEPLOYMENT':
          await this.executeDeleteDeployment(operation);
          break;
        case 'UPDATE_DEVICE_LORAWAN_STATUS':
          await this.executeUpdateDeviceLoRaWANStatus(operation);
          break;
        default:
          console.warn(`Unknown operation type: ${operation.type}`);
          return false;
      }

      // Remove successful operation from queue
      await this.databaseService.markQueueItemCompleted(operation.id);
      return true;
    } catch (error) {
      console.error(`Failed to execute operation ${operation.id}:`, error);
      
      // Update retry count and requeue if within limits
      if (this.shouldRetryOperation(operation)) {
        // Update retry count in queue
        await this.databaseService.updateQueueItemRetry(
          operation.id, 
          operation.retry_count + 1, 
          'pending'
        );
      }
      
      return false;
    }
  }

  /**
   * Sync all pending operations based on user role
   */
  async syncPendingOperations(user?: User): Promise<void> {
    if (!this.networkStatus.isConnected) return;

    try {
      const operations = await this.getOperationsForSync(user);
      
      for (const operation of operations) {
        if (user && !this.canUserPerformOperation(user, operation)) {
          console.warn(`User ${user.id} cannot perform operation ${operation.id}, skipping`);
          continue;
        }

        // Check if operation needs retry delay
        if (!this.isOperationReadyForRetry(operation)) {
          continue;
        }

        await this.executeOperation(operation);
      }
    } catch (error) {
      console.error('Failed to sync pending operations:', error);
    }
  }

  /**
   * Get operations for sync based on user role
   */
  async getOperationsForSync(user?: User): Promise<OfflineOperation[]> {
    let queueItems: any[];
    
    if (!user) {
      queueItems = await this.databaseService.getPendingQueueItems();
    } else {
      switch (user.role) {
        case 'ww_admin':
          // WW Admin can sync all organisations
          queueItems = await this.databaseService.getPendingQueueItems();
          break;
          
        case 'project_admin':
        case 'project_member':
          // Organisation-scoped operations only
          queueItems = await this.databaseService.getQueueItemsByOrganisation(user.organisation_id);
          break;
          
        default:
          queueItems = [];
      }
    }

    // Convert queue items to operations
    return queueItems.map(item => ({
      id: item.id,
      type: item.type,
      data: JSON.parse(item.data),
      user_id: item.user_id,
      organisation_id: item.organisation_id,
      timestamp: new Date(item.timestamp),
      retry_count: item.retry_count
    }));
  }

  /**
   * Check if user can perform a specific operation (role-based validation)
   */
  canUserPerformOperation(user: User, operation: OfflineOperation): boolean {
    // WW Admin can perform any operation
    if (user.role === 'ww_admin') {
      return true;
    }

    // Check organisation boundaries for non-admin users
    if (operation.organisation_id !== user.organisation_id) {
      return false;
    }

    // Role-specific operation validation
    switch (user.role) {
      case 'project_admin':
        // Project admin can perform most operations within their organisation
        return this.isProjectAdminOperation(operation.type);
        
      case 'project_member':
        // Project member has limited operations
        return this.isProjectMemberOperation(operation.type);
        
      default:
        return false;
    }
  }

  /**
   * Check if operation is allowed for project_admin role
   */
  private isProjectAdminOperation(operationType: OfflineOperationType): boolean {
    const allowedOperations: OfflineOperationType[] = [
      'CREATE_PROJECT',
      'UPDATE_PROJECT',
      'DELETE_PROJECT',
      'CREATE_DEPLOYMENT',
      'UPDATE_DEPLOYMENT',
      'DELETE_DEPLOYMENT',
      'UPDATE_DEVICE_LORAWAN_STATUS'
    ];
    return allowedOperations.includes(operationType);
  }

  /**
   * Check if operation is allowed for project_member role
   */
  private isProjectMemberOperation(operationType: OfflineOperationType): boolean {
    const allowedOperations: OfflineOperationType[] = [
      'CREATE_DEPLOYMENT',
      'UPDATE_DEPLOYMENT',
      'UPDATE_DEVICE_LORAWAN_STATUS'
    ];
    return allowedOperations.includes(operationType);
  }

  /**
   * Update LoRaWAN device status with offline caching
   */
  async updateDeviceLoRaWANStatus(deviceId: string, status: LoRaWANStatus, deploymentId?: string): Promise<void> {
    // Always cache status locally for offline access (if we have deployment ID)
    if (deploymentId) {
      await this.databaseService.updateDeploymentLoRaWANStatus(deploymentId, status);
    }

    // If offline, queue the update for sync
    if (!this.networkStatus.isConnected) {
      const operation: OfflineOperation = {
        id: `lorawan-update-${deviceId}-${Date.now()}`,
        type: 'UPDATE_DEVICE_LORAWAN_STATUS',
        data: { device_id: deviceId, status, deployment_id: deploymentId },
        user_id: '', // Will be set by caller
        organisation_id: '', // Will be set by caller
        timestamp: new Date(),
        retry_count: 0
      };
      
      await this.queueOperation(operation);
    }
  }

  /**
   * Detect potential conflicts between server and local data
   */
  detectPotentialConflict(serverData: any, localData: any): boolean {
    if (!serverData.updated_at || !localData.updated_at) {
      return false; // Cannot detect conflicts without timestamps
    }

    const serverTime = new Date(serverData.updated_at);
    const localTime = new Date(localData.updated_at);

    // Conflict if times differ (server and local modifications)
    return serverTime.getTime() !== localTime.getTime();
  }

  /**
   * Prepare conflict data for resolution
   */
  prepareConflictResolution(serverData: any, localData: any): ConflictResolution {
    return {
      id: serverData.id || localData.id,
      server_version: serverData,
      local_version: localData,
      conflict_type: 'data_modification',
      needs_user_resolution: true
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.BASE_RETRY_DELAY * Math.pow(2, retryCount),
      this.MAX_RETRY_DELAY
    );
    return delay;
  }

  /**
   * Check if operation should be retried
   */
  shouldRetryOperation(operation: OfflineOperation): boolean {
    return operation.retry_count < this.MAX_RETRY_ATTEMPTS;
  }

  /**
   * Check if operation is ready for retry based on backoff delay
   */
  private isOperationReadyForRetry(operation: OfflineOperation): boolean {
    if (operation.retry_count === 0) return true;

    const retryDelay = this.calculateRetryDelay(operation.retry_count);
    const timeSinceLastAttempt = Date.now() - operation.timestamp.getTime();
    
    return timeSinceLastAttempt >= retryDelay;
  }

  // Operation execution methods
  private async executeCreateProject(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to create project
    console.log('Executing CREATE_PROJECT:', operation.data);
  }

  private async executeUpdateProject(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to update project
    console.log('Executing UPDATE_PROJECT:', operation.data);
  }

  private async executeDeleteProject(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to delete project
    console.log('Executing DELETE_PROJECT:', operation.data);
  }

  private async executeCreateDeployment(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to create deployment
    console.log('Executing CREATE_DEPLOYMENT:', operation.data);
  }

  private async executeUpdateDeployment(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to update deployment
    console.log('Executing UPDATE_DEPLOYMENT:', operation.data);
  }

  private async executeDeleteDeployment(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to delete deployment
    console.log('Executing DELETE_DEPLOYMENT:', operation.data);
  }

  private async executeUpdateDeviceLoRaWANStatus(operation: OfflineOperation): Promise<void> {
    // TODO: Implement actual API call to update device LoRaWAN status
    console.log('Executing UPDATE_DEVICE_LORAWAN_STATUS:', operation.data);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = undefined;
    }
    
    this.initialized = false;
  }
}