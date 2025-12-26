
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Deployment from '../database/models/Deployment'
import OutboxService from './OutboxService'
import SupabaseSyncService from './SupabaseSyncService'

// Deployment Status IDs based on backend schema
// 1 = deployed (Active)
// 2 = recovery (Ended)
// 3 = failed (Failed)
export const DEPLOYMENT_STATUS = {
    DEPLOYED: 1,
    RECOVERY: 2,
    FAILED: 3
}

export const DeploymentService = {
    /**
     * Create a new deployment
     */
    createDeployment: async (
        data: {
            name: string
            projectId: string
            deviceId: string
            devicePreparationId: string
            setupBy: string
            locationName: string
            latitude?: number
            longitude?: number
            altitude?: number
            accuracy?: number
            startComments?: string
            cameraImagePaths?: string[]
            cameraHeight?: number
            locationDescription?: string
            captureMethodId?: number
        }
    ): Promise<Deployment> => {
        console.log('[DeploymentService] Creating deployment:', data.name)

        // Fetch Project Settings for Snapshot
        const projectService = require('./ProjectService').default // Dynamic import to avoid cycles if any
        const project = await projectService.getProjectById(data.projectId)
        const sensitivityId = project?.activity_detection_sensitivity_id
        const timelapseInterval = project?.timelapse_interval_seconds

        let newDeployment: Deployment | undefined

        await database.write(async () => {
            const deploymentsCollection = database.get<Deployment>('deployments')

            // 1. Prepare record
            newDeployment = deploymentsCollection.prepareCreate((deployment) => {
                deployment.name = data.name
                deployment.projectId = data.projectId
                // deployment.userId = data.userId // REMOVED
                deployment.deviceId = data.deviceId
                deployment.devicePreparationId = data.devicePreparationId
                deployment.setupBy = data.setupBy
                deployment.deploymentStart = new Date().getTime()
                deployment.deploymentStatusId = DEPLOYMENT_STATUS.DEPLOYED

                // Add capture method if provided
                if (data.captureMethodId) {
                    deployment.captureMethodId = data.captureMethodId
                }

                // Snapshot Project Settings
                if (sensitivityId) deployment.activityDetectionSensitivityId = sensitivityId
                if (timelapseInterval) deployment.timelapseIntervalSeconds = timelapseInterval

                // Location data
                deployment.locationName = data.locationName
                deployment.latitude = data.latitude
                deployment.longitude = data.longitude
                deployment.altitude = data.altitude
                deployment.accuracy = data.accuracy
                deployment.locationDescription = data.locationDescription

                // Standardize Camera Height to meters (input is cm)
                if (data.cameraHeight) {
                    deployment.cameraHeight = data.cameraHeight / 100
                }

                // Store image paths as JSON string array if provided
                if (data.cameraImagePaths) {
                    deployment.cameraLocationImagePaths = JSON.stringify(data.cameraImagePaths)
                }

                deployment.startDeploymentComments = data.startComments
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'CREATE',
                tableName: 'deployments',
                recordId: newDeployment.id,
                payload: mapModelToPayload(newDeployment),
                userId: data.setupBy,
            })

            // 3. Execute batch
            await database.batch(newDeployment, outboxOp)
            console.log('[DeploymentService] Created deployment and outbox record:', newDeployment.id)
        })

        if (!newDeployment) throw new Error("Failed to create deployment instance")

        // 4. Touch Device to trigger observers/refresh
        try {
            await database.write(async () => {
                const device = await database.get('devices').find(data.deviceId)
                await device.update(() => {
                    // Just update the timestamp to trigger reactivity
                    // (WatermelonDB models update updatedAt automatically on save)
                })
            })
            console.log('[DeploymentService] Touched device:', data.deviceId)
        } catch (e) {
            console.warn('[DeploymentService] Failed to touch device:', e)
        }

        // Trigger background sync
        SupabaseSyncService.debouncedSync()

        return newDeployment
    },

    /**
     * End a deployment
     */
    endDeployment: async (
        deploymentId: string,
        endedBy: string | null,
        notes?: string
    ): Promise<Deployment> => {
        console.log('[DeploymentService] Ending deployment:', deploymentId)

        return await database.write(async () => {
            const deploymentsCollection = database.get<Deployment>('deployments')
            const deployment = await deploymentsCollection.find(deploymentId)

            // 1. Prepare update
            const updateOp = deployment.prepareUpdate((record) => {
                record.deploymentStatusId = DEPLOYMENT_STATUS.RECOVERY
                record.deploymentEnd = new Date().getTime()
                record.endedBy = endedBy ?? undefined
                record.endDeploymentComments = notes
            })

            // 2. Prepare outbox record
            const outboxOp = OutboxService.recordOperation({
                operation: 'UPDATE',
                tableName: 'deployments',
                recordId: deployment.id,
                payload: mapModelToPayload(deployment),
                userId: endedBy ?? 'system', // Fallback if null, but should be provided
            })

            // 3. Execute batch
            await database.batch(updateOp, outboxOp)

            // Trigger background sync
            SupabaseSyncService.debouncedSync()

            return deployment
        })
    },

    /**
     * Get deployment by ID
     */
    getDeploymentById: async (id: string): Promise<Deployment | undefined> => {
        try {
            const deploymentsCollection = database.get<Deployment>('deployments')
            return await deploymentsCollection.find(id)
        } catch (error) {
            console.log('[DeploymentService] Deployment not found locally:', id)
            return undefined
        }
    },

    /**
     * Observe deployment by ID
     */
    observeDeploymentById: (id: string) => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        return deploymentsCollection.findAndObserve(id)
    },

    /**
     * Get active deployment for a device
     */
    getActiveDeploymentForDevice: async (devicePreparationId: string): Promise<Deployment | undefined> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query(
            Q.where('device_preparation_id', devicePreparationId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.DEPLOYED),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()

        return deployments[0]
    },

    /**
     * Get active deployment for a device by Device ID
     */
    getActiveDeploymentForDeviceId: async (deviceId: string): Promise<Deployment | undefined> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.DEPLOYED),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()

        return deployments[0]
    },

    /**
     * Observe all deployments (sorted by creation date)
     */
    observeDeployments: () => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        return deploymentsCollection.query(
            Q.sortBy('created_at', Q.desc)
        ).observe()
    }
}

/**
 * Helper to map model to plain object for sync (snake_case)
 */
function mapModelToPayload(model: Deployment): any {
    return {
        id: model.id,
        project_id: model.projectId,
        // user_id: model.userId, // REMOVED
        device_id: model.deviceId,
        device_preparation_id: model.devicePreparationId,
        name: model.name,
        setup_by: model.setupBy,
        deployment_start: new Date(model.deploymentStart).toISOString(),
        ended_by: model.endedBy || null,
        deployment_end: (model.deploymentEnd && model.deploymentEnd > 1000) ? new Date(model.deploymentEnd).toISOString() : null,
        deployment_status_id: model.deploymentStatusId,
        capture_method_id: model.captureMethodId || null,
        activity_detection_sensitivity_id: model.activityDetectionSensitivityId || null,
        timelapse_interval_seconds: model.timelapseIntervalSeconds || null,
        start_deployment_comments: model.startDeploymentComments || null,
        end_deployment_comments: model.endDeploymentComments || null,

        location_name: model.locationName,
        location_description: model.locationDescription || null,
        altitude: model.altitude || null,
        accuracy: model.accuracy || null,
        camera_location_image_paths: model.cameraLocationImagePaths ? JSON.parse(model.cameraLocationImagePaths) : null,
        latitude: model.latitude || null,
        longitude: model.longitude || null,

        created_at: new Date(model.createdAt).toISOString(),
        updated_at: new Date(model.updatedAt).toISOString(),
        deleted_at: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
    }
}
