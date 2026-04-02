/**
 * Device-related TypeScript types
 */

import Device from '../database/models/Device'
import Deployment from '../database/models/Deployment'

/**
 * Device status enum
 */
export type DeviceStatus = 'deployed' | 'prepared' | 'needs_preparation'

/**
 * Device with calculated status and related entities
 */
export interface DeviceWithStatus {
    device: Device
    status: DeviceStatus
    activeDeployment?: Deployment
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
    deploymentName?: string
    deploymentId?: string
    deploymentEndDate?: Date
    lastDeploymentDate?: Date
    projectName?: string
}

