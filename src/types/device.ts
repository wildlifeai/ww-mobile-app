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
    lastDeployment?: Deployment
}
