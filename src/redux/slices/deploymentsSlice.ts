import { PayloadAction, createSlice } from "@reduxjs/toolkit";

// Types for deployment management with LoRaWAN integration
export interface LoRaWANStatus {
  battery_level: number; // 0-100 percentage
  sd_card_usage: number; // 0-100 percentage
  signal_strength?: number; // RSSI value
  last_seen?: string; // ISO timestamp
  device_status: 'online' | 'offline' | 'error';
}

export interface DeploymentDevice {
  id: string;
  name: string;
  mac_address: string;
  firmware_version?: string;
  lorawan_status?: LoRaWANStatus;
  last_sync?: string; // ISO timestamp
}

export interface Deployment {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  organisation_id: string; // For organisation scoping
  created_by: string;
  created_at: string;
  updated_at: string;
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    notes?: string;
  };
  devices: DeploymentDevice[];
  total_observations: number;
  last_observation?: string;
}

interface DeploymentsState {
  deployments: Deployment[];
  currentDeployment?: Deployment;
  activeDeployments: Deployment[];
  loading: boolean;
  error?: string;
  // Real-time LoRaWAN updates
  deviceStatusUpdates: Record<string, LoRaWANStatus>;
  lastStatusUpdate?: string;
}

const initialState: DeploymentsState = {
  deployments: [],
  activeDeployments: [],
  loading: false,
  deviceStatusUpdates: {},
};

// Helper function to validate deployment data
const validateDeployment = (deployment: Deployment): string | null => {
  if (!deployment.id) return 'Deployment ID is required';
  if (!deployment.name || deployment.name.trim() === '') return 'Deployment name is required';
  if (!deployment.project_id) return 'Project ID is required';
  if (!deployment.organisation_id) return 'Organisation ID is required';
  if (!deployment.created_by) return 'Creator ID is required';
  if (!deployment.start_date) return 'Start date is required';
  
  // Validate location
  if (!deployment.location || 
      typeof deployment.location.latitude !== 'number' ||
      typeof deployment.location.longitude !== 'number') {
    return 'Valid location coordinates are required';
  }
  
  return null;
};

// Helper function to check if user has permission to modify deployment
const canModifyDeployment = (deployment: Deployment, currentUser: any): boolean => {
  // WW Admin can modify any deployment
  if (currentUser?.role === 'ww_admin') return true;
  
  // Deployment creator can modify
  if (deployment.created_by === currentUser?.id) return true;
  
  // Project admin can modify deployments in their projects
  if (currentUser?.role === 'project_admin' && 
      deployment.organisation_id === currentUser?.organisation_id) return true;
  
  // Project members can modify their own deployments
  if (deployment.created_by === currentUser?.id) return true;
  
  return false;
};

// Helper function to update LoRaWAN status
const updateDeviceLoRaWANStatus = (device: DeploymentDevice, status: LoRaWANStatus): DeploymentDevice => {
  return {
    ...device,
    lorawan_status: {
      ...device.lorawan_status,
      ...status,
    },
    last_sync: new Date().toISOString()
  };
};

export const deploymentsSlice = createSlice({
  name: "deployments",
  initialState,
  reducers: {
    setDeployments: (state, action: PayloadAction<Deployment[]>) => {
      // Filter deployments by current organisation for security
      const currentOrgId = (state as any).authentication?.currentOrganisation?.id;
      const userRole = (state as any).authentication?.user?.role;
      
      if (userRole === 'ww_admin') {
        // WW Admin can see all deployments
        state.deployments = action.payload;
      } else {
        // Filter by current organisation
        state.deployments = action.payload.filter(d => d.organisation_id === currentOrgId);
      }
      
      // Update active deployments
      state.activeDeployments = state.deployments.filter(d => d.status === 'active');
      
      state.loading = false;
      state.error = undefined;
    },
    
    createDeployment: (state, action: PayloadAction<Deployment>) => {
      const deployment = action.payload;
      const validationError = validateDeployment(deployment);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      // Check organisation scope
      const currentOrgId = (state as any).authentication?.currentOrganisation?.id;
      const userRole = (state as any).authentication?.user?.role;
      
      if (userRole !== 'ww_admin' && deployment.organisation_id !== currentOrgId) {
        state.error = 'Cannot create deployment in different organisation';
        return;
      }
      
      state.deployments.push(deployment);
      
      // Add to active deployments if status is active
      if (deployment.status === 'active') {
        state.activeDeployments.push(deployment);
      }
      
      state.error = undefined;
    },
    
    updateDeployment: (state, action: PayloadAction<{id: string, updates: Partial<Deployment>}>) => {
      const { id, updates } = action.payload;
      const deploymentIndex = state.deployments.findIndex(d => d.id === id);
      
      if (deploymentIndex === -1) {
        state.error = 'Deployment not found';
        return;
      }
      
      const deployment = state.deployments[deploymentIndex];
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyDeployment(deployment, currentUser)) {
        state.error = 'Insufficient permissions to update deployment';
        return;
      }
      
      // Validate updates
      const updatedDeployment = { 
        ...deployment, 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
      const validationError = validateDeployment(updatedDeployment);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      state.deployments[deploymentIndex] = updatedDeployment;
      
      // Update active deployments list
      state.activeDeployments = state.deployments.filter(d => d.status === 'active');
      
      // Update current deployment if it's the one being updated
      if (state.currentDeployment?.id === id) {
        state.currentDeployment = updatedDeployment;
      }
      
      state.error = undefined;
    },
    
    deleteDeployment: (state, action: PayloadAction<string>) => {
      const deploymentId = action.payload;
      const deployment = state.deployments.find(d => d.id === deploymentId);
      
      if (!deployment) {
        state.error = 'Deployment not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyDeployment(deployment, currentUser)) {
        state.error = 'Insufficient permissions to delete deployment';
        return;
      }
      
      state.deployments = state.deployments.filter(d => d.id !== deploymentId);
      state.activeDeployments = state.activeDeployments.filter(d => d.id !== deploymentId);
      
      // Clear current deployment if it was deleted
      if (state.currentDeployment?.id === deploymentId) {
        state.currentDeployment = undefined;
      }
      
      state.error = undefined;
    },
    
    setCurrentDeployment: (state, action: PayloadAction<string>) => {
      const deploymentId = action.payload;
      const deployment = state.deployments.find(d => d.id === deploymentId);
      
      if (deployment) {
        state.currentDeployment = deployment;
        state.error = undefined;
      } else {
        state.error = 'Deployment not found';
      }
    },
    
    // LoRaWAN Integration Actions (REQUIRED by spec Section 7.3)
    updateDeviceLoRaWANStatus: (state, action: PayloadAction<{
      deviceId: string,
      status: LoRaWANStatus
    }>) => {
      const { deviceId, status } = action.payload;
      
      // Update device status in deployments
      state.deployments.forEach(deployment => {
        const deviceIndex = deployment.devices.findIndex(d => d.id === deviceId);
        if (deviceIndex !== -1) {
          deployment.devices[deviceIndex] = updateDeviceLoRaWANStatus(
            deployment.devices[deviceIndex], 
            status
          );
        }
      });
      
      // Update active deployments
      state.activeDeployments.forEach(deployment => {
        const deviceIndex = deployment.devices.findIndex(d => d.id === deviceId);
        if (deviceIndex !== -1) {
          deployment.devices[deviceIndex] = updateDeviceLoRaWANStatus(
            deployment.devices[deviceIndex], 
            status
          );
        }
      });
      
      // Update current deployment if it contains this device
      if (state.currentDeployment) {
        const deviceIndex = state.currentDeployment.devices.findIndex(d => d.id === deviceId);
        if (deviceIndex !== -1) {
          state.currentDeployment.devices[deviceIndex] = updateDeviceLoRaWANStatus(
            state.currentDeployment.devices[deviceIndex], 
            status
          );
        }
      }
      
      // Store status update for real-time tracking
      state.deviceStatusUpdates[deviceId] = status;
      state.lastStatusUpdate = new Date().toISOString();
    },
    
    // Bulk LoRaWAN status update from webhook
    bulkUpdateDeviceStatus: (state, action: PayloadAction<Record<string, LoRaWANStatus>>) => {
      const statusUpdates = action.payload;
      
      Object.entries(statusUpdates).forEach(([deviceId, status]) => {
        // Update all deployments containing this device
        state.deployments.forEach(deployment => {
          const deviceIndex = deployment.devices.findIndex(d => d.id === deviceId);
          if (deviceIndex !== -1) {
            deployment.devices[deviceIndex] = updateDeviceLoRaWANStatus(
              deployment.devices[deviceIndex], 
              status
            );
          }
        });
      });
      
      // Update active deployments
      state.activeDeployments = state.deployments.filter(d => d.status === 'active');
      
      // Update status tracking
      state.deviceStatusUpdates = { ...state.deviceStatusUpdates, ...statusUpdates };
      state.lastStatusUpdate = new Date().toISOString();
    },
    
    addDeviceToDeployment: (state, action: PayloadAction<{
      deploymentId: string,
      device: DeploymentDevice
    }>) => {
      const { deploymentId, device } = action.payload;
      const deployment = state.deployments.find(d => d.id === deploymentId);
      
      if (!deployment) {
        state.error = 'Deployment not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyDeployment(deployment, currentUser)) {
        state.error = 'Insufficient permissions to add device';
        return;
      }
      
      // Check if device already exists
      const existingDevice = deployment.devices.find(d => d.id === device.id);
      if (existingDevice) {
        state.error = 'Device already exists in deployment';
        return;
      }
      
      deployment.devices.push(device);
      
      // Update current deployment if it's the one being modified
      if (state.currentDeployment?.id === deploymentId) {
        state.currentDeployment.devices = deployment.devices;
      }
      
      state.error = undefined;
    },
    
    removeDeviceFromDeployment: (state, action: PayloadAction<{
      deploymentId: string,
      deviceId: string
    }>) => {
      const { deploymentId, deviceId } = action.payload;
      const deployment = state.deployments.find(d => d.id === deploymentId);
      
      if (!deployment) {
        state.error = 'Deployment not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyDeployment(deployment, currentUser)) {
        state.error = 'Insufficient permissions to remove device';
        return;
      }
      
      deployment.devices = deployment.devices.filter(d => d.id !== deviceId);
      
      // Update current deployment if it's the one being modified
      if (state.currentDeployment?.id === deploymentId) {
        state.currentDeployment.devices = deployment.devices;
      }
      
      // Clear device status updates
      delete state.deviceStatusUpdates[deviceId];
      
      state.error = undefined;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = undefined;
    }
  },
});

export const {
  setDeployments,
  createDeployment,
  updateDeployment,
  deleteDeployment,
  setCurrentDeployment,
  updateDeviceLoRaWANStatus,
  bulkUpdateDeviceStatus,
  addDeviceToDeployment,
  removeDeviceFromDeployment,
  setLoading,
  setError,
  clearError
} = deploymentsSlice.actions;

// Selectors for easy access to deployments state
export const selectDeployments = (state: { deployments: DeploymentsState }) => 
  state.deployments.deployments;

export const selectActiveDeployments = (state: { deployments: DeploymentsState }) => 
  state.deployments.activeDeployments;

export const selectCurrentDeployment = (state: { deployments: DeploymentsState }) => 
  state.deployments.currentDeployment;

export const selectDeploymentsLoading = (state: { deployments: DeploymentsState }) => 
  state.deployments.loading;

export const selectDeploymentsError = (state: { deployments: DeploymentsState }) => 
  state.deployments.error;

export const selectDeviceStatusUpdates = (state: { deployments: DeploymentsState }) => 
  state.deployments.deviceStatusUpdates;

// Organisation and project scoped selectors
export const selectDeploymentsByProject = (projectId: string) =>
  (state: { deployments: DeploymentsState }) =>
    state.deployments.deployments.filter(d => d.project_id === projectId);

export const selectDeploymentsByOrganisation = (organisationId: string) =>
  (state: { deployments: DeploymentsState }) =>
    state.deployments.deployments.filter(d => d.organisation_id === organisationId);

export const selectUserDeployments = (userId: string) =>
  (state: { deployments: DeploymentsState }) =>
    state.deployments.deployments.filter(d => d.created_by === userId);

// LoRaWAN status selectors
export const selectDeviceLoRaWANStatus = (deviceId: string) =>
  (state: { deployments: DeploymentsState }) =>
    state.deployments.deviceStatusUpdates[deviceId];

export const selectLowBatteryDevices = (threshold: number = 20) =>
  (state: { deployments: DeploymentsState }) =>
    Object.entries(state.deployments.deviceStatusUpdates)
      .filter(([_, status]) => status.battery_level < threshold)
      .map(([deviceId, status]) => ({ deviceId, ...status }));

export const selectHighStorageDevices = (threshold: number = 80) =>
  (state: { deployments: DeploymentsState }) =>
    Object.entries(state.deployments.deviceStatusUpdates)
      .filter(([_, status]) => status.sd_card_usage > threshold)
      .map(([deviceId, status]) => ({ deviceId, ...status }));

export default deploymentsSlice.reducer;