/**
 * Device-related TypeScript types
 */

import Device from '../database/models/Device'
import DevicePreparation from '../database/models/DevicePreparation'
import Deployment from '../database/models/Deployment'

/**
 * Device status enum
 */
export type DeviceStatus = 'deployed' | 'prepared' | 'needs_preparation'

/**
 * Device preparation status enum
 */
export type PreparationStatus = 'in_progress' | 'completed' | 'cancelled'

/**
 * Device with calculated status and related entities
 */
export interface DeviceWithStatus {
    device: Device
    status: DeviceStatus
    activeDeployment?: Deployment
    lastPreparation?: DevicePreparation
    preparedDate?: Date
}

/**
 * Status badge configuration
 */
export interface StatusBadgeConfig {
    label: string
    color: string
    icon?: string
}

/**
 * Device list item for UI display
 */
export interface DeviceListItem {
    id: string
    name: string
    bluetoothId: string
    status: DeviceStatus
    batteryLevel?: number
    deploymentName?: string
    deploymentId?: string
    deploymentEndDate?: Date
    lastDeploymentDate?: Date
    projectName?: string
    preparedDate?: Date
}
