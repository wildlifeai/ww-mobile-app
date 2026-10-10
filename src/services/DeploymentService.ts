
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Deployment from '../database/models/Deployment'
import Device from '../database/models/Device'
import SyncOutbox from '../database/models/SyncOutbox'
import OutboxService from './OutboxService'
import SupabaseSyncService from './SupabaseSyncService'
import ProjectService from './ProjectService'
import { getSupabaseClient } from './supabase'
import { isKnownOffline } from './connectivityWatch'
import { seesEverything, seesOrganisation } from './roleAccess'
import { log, logError, logWarn } from '../utils/logger'
import { logCloudFailure } from '../utils/networkErrors'


// Deployment Status IDs based on backend deployment_statuses lookup table
// 1 = planned, 2 = started (active), 3 = ended
export const DEPLOYMENT_STATUS = {
    PLANNED: 1,
    STARTED: 2,
    ENDED: 3
}

/**
 * What the server said, before a start, about another open deployment on the
 * camera (#448). `message` is for the operator: the reason to stop when one is
 * open, the warning when the server could not be asked.
 */
export type OpenDeploymentCheck =
    | { kind: 'none' }
    | { kind: 'open'; message: string }
    | { kind: 'unchecked'; message: string }

/**
 * How long a start waits for the answer before carrying on unchecked. The
 * client's own limit on a read is 30 s (supabaseFetch.ts), too long to hold an
 * operator at the camera for a check that never blocks offline anyway.
 */
const OPEN_DEPLOYMENT_CHECK_MS = 10_000

const UNCHECKED_WARNING = 'Could not ask the server whether this camera is still deployed elsewhere. If it is, the server will refuse this deployment.'

export const DeploymentService = {
    /**
     * Create a new deployment
     */
    createDeployment: async (
        data: {
            name: string
            projectId: string
            deviceId: string
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
            // Device Snapshot Fields
            cameraModel?: string
            lorawanNetwork?: string
            deviceEui?: string
            lorawanRegistrationCompleted?: boolean
            lorawanLastVerifiedAt?: Date | null
            aiModelId?: string
            bleFirmwareId?: string
            himaxFirmwareId?: string
            batteryLevelAtStart?: number
            sdCardTotalKbAtStart?: number
            sdCardAvailableKbAtStart?: number
            lorawanRssiAtStart?: number
            lorawanSnrAtStart?: number
        }
    ): Promise<Deployment> => {
        log('[DeploymentService] Creating deployment:', data.name)

        // Fetch Project Settings for Snapshot
        const project = await ProjectService.getProjectById(data.projectId)
        const sensitivityId = project?.activity_detection_sensitivity_id
        const timelapseInterval = project?.timelapse_interval_seconds

        let newDeployment: Deployment | undefined

        await database.write(async () => {
            const deploymentsCollection = database.get<Deployment>('deployments')

            try {
                // 1. Prepare record
                log('[DeploymentService] Step 1: Preparing deployment record')
                newDeployment = deploymentsCollection.prepareCreate((deployment) => {
                    deployment.name = data.name
                    deployment.projectId = data.projectId
                    // deployment.userId = data.userId // REMOVED
                    deployment.deviceId = data.deviceId
                    deployment.setupBy = data.setupBy
                    deployment.deploymentStart = new Date()
                    deployment.deploymentStatusId = DEPLOYMENT_STATUS.STARTED

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
                        deployment.cameraLocationImagePaths = data.cameraImagePaths
                    }

                    deployment.startDeploymentComments = data.startComments

                    // Initialize required JSON fields to defaults to prevent schema validation errors
                    deployment.location = {}
                    deployment.deploymentPhotos = []
                    deployment.modifiedBy = data.setupBy

                    // Device Snapshot
                    deployment.cameraModel = data.cameraModel
                    deployment.lorawanNetwork = data.lorawanNetwork
                    deployment.deviceEui = data.deviceEui
                    deployment.lorawanRegistrationCompleted = data.lorawanRegistrationCompleted
                    deployment.lorawanLastVerifiedAt = data.lorawanLastVerifiedAt
                    deployment.aiModelId = data.aiModelId
                    deployment.bleFirmwareId = data.bleFirmwareId
                    deployment.himaxFirmwareId = data.himaxFirmwareId
                    deployment.batteryLevelAtStart = data.batteryLevelAtStart
                    deployment.sdCardTotalKbAtStart = data.sdCardTotalKbAtStart
                    deployment.sdCardAvailableKbAtStart = data.sdCardAvailableKbAtStart
                    deployment.lorawanRssiAtStart = data.lorawanRssiAtStart
                    deployment.lorawanSnrAtStart = data.lorawanSnrAtStart

                    log('[DeploymentService] Preparation function complete')
                })

                log('[DeploymentService] Step 1 complete: Record prepared with ID:', newDeployment.id)

                // 2. Prepare outbox record
                log('[DeploymentService] Step 2: Mapping payload')
                let payload
                try {
                    payload = mapModelToPayload(newDeployment)
                    log('[DeploymentService] Payload mapped successfully')
                } catch (mapErr) {
                    logError('[DeploymentService] Error mapping payload:', mapErr)
                    throw mapErr
                }

                log('[DeploymentService] Step 3: Recording operation')
                const outboxOp = OutboxService.recordOperation({
                    operation: 'CREATE',
                    tableName: 'deployments',
                    recordId: newDeployment.id,
                    payload,
                    userId: data.setupBy,
                })
                log('[DeploymentService] Step 3 complete: Outbox op prepared')

                // 3. Execute batch
                log('[DeploymentService] Step 4: Batching operations')
                await database.batch(newDeployment, outboxOp)
                log('[DeploymentService] Created deployment and outbox record:', newDeployment.id)
            } catch (err) {
                logError('[DeploymentService] Critical error in createDeployment batch:', err)
                throw err
            }
        })

        if (!newDeployment) throw new Error("Failed to create deployment instance")

        // 4. Ensure the device is queued for sync, then touch it for reactivity.
        //
        // A deployment's device_id is a foreign key: push_changes inserts the
        // deployment only if the device row already exists on the server. The
        // device usually reaches the server from its own CREATE op at discovery
        // (DeviceService.createDevice), but that op can be gone — e.g. it was
        // refused before the devices INSERT policy existed (ww-backend #179) and
        // then abandoned. When it is, the deployment push fails with 23503 and
        // only the self-healing retry in SupabaseSyncService recovers it, one
        // cycle late, which the operator sees as a sync error.
        //
        // So queue an idempotent device CREATE here. push_changes' devices insert
        // is ON CONFLICT (id) DO NOTHING, so re-queuing a device already on the
        // server is a harmless no-op; if it is missing, the ordered push (devices
        // before deployments) now satisfies the foreign key on the first attempt
        // and the self-heal stays a fallback. Skipped when a device CREATE is
        // already waiting in the outbox, so no duplicate op is made.
        try {
            const device = await database.get<Device>('devices').find(data.deviceId)

            const pendingDeviceCreate = await database.get<SyncOutbox>('sync_outbox').query(
                Q.where('table_name', 'devices'),
                Q.where('record_id', device.id),
                Q.where('operation_type', 'CREATE'),
                Q.where('status', Q.oneOf(['pending', 'syncing', 'failed'])),
            ).fetch()

            await database.write(async () => {
                const batchOps: (Device | SyncOutbox)[] = [
                    // Bump updated_at to trigger observers/refresh.
                    device.prepareUpdate(() => {}),
                ]

                if (pendingDeviceCreate.length === 0) {
                    batchOps.push(OutboxService.recordOperation({
                        operation: 'CREATE',
                        tableName: 'devices',
                        recordId: device.id,
                        payload: {
                            id: device.id,
                            bluetooth_id: device.bluetoothId,
                            name: device.name,
                            organisation_id: device.organisationId || null,
                            device_eui: device.deviceEui || null,
                            modified_by: data.setupBy,
                        },
                        userId: data.setupBy,
                    }))
                }

                await database.batch(...batchOps)
            })
            log('[DeploymentService] Ensured device is queued for sync:', data.deviceId)
        } catch (e) {
            logWarn('[DeploymentService] Failed to ensure device is queued for sync:', e)
        }

        // Send it now rather than after the 2 s debounce. The camera is given
        // this id next and stamps every photo with it, and the operator may
        // quit the app on the live view before anything else syncs
        SupabaseSyncService.requestSync()

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
        log('[DeploymentService] Ending deployment:', deploymentId)

        const ended = await database.write(async () => {
            const deploymentsCollection = database.get<Deployment>('deployments')
            const deployment = await deploymentsCollection.find(deploymentId)

            // The end and its outbox record, which carries only the columns the end changed
            const [updateOp, outboxOp] = prepareDeploymentUpdate(
                deployment,
                endedBy ?? 'system', // Fallback if null, but should be provided
                (record) => {
                    record.deploymentStatusId = DEPLOYMENT_STATUS.ENDED
                    record.deploymentEnd = new Date()
                    record.endedBy = endedBy ?? undefined
                    record.endDeploymentComments = notes
                    record.modifiedBy = endedBy ?? 'system'
                },
            )

            await database.batch(updateOp, outboxOp)

            return deployment
        })

        // The end, as soon as it is written, as for createDeployment
        SupabaseSyncService.requestSync()

        return ended
    },

    /**
     * Get deployment by ID
     */
    getDeploymentById: async (id: string): Promise<Deployment | undefined> => {
        try {
            const deploymentsCollection = database.get<Deployment>('deployments')
            return await deploymentsCollection.find(id)
        } catch (error) {
            log('[DeploymentService] Deployment not found locally:', id)
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
    getActiveDeploymentForDevice: async (deviceId: string): Promise<Deployment | undefined> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.STARTED),
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
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.STARTED),
            Q.sortBy('deployment_start', Q.desc)
        ).fetch()

        return deployments[0]
    },

    /**
     * Get last ended deployment for a device
     */
    getLastEndedDeploymentForDeviceId: async (deviceId: string): Promise<Deployment | undefined> => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        const deployments = await deploymentsCollection.query(
            Q.where('device_id', deviceId),
            Q.where('deployment_status_id', DEPLOYMENT_STATUS.ENDED),
            Q.sortBy('deployment_end', Q.desc),
            Q.take(1)
        ).fetch()

        return deployments[0]
    },

    /**
     * Ask the server whether a camera has an open deployment this phone does
     * not hold, before a start writes anything to it (#448).
     *
     * A camera has at most one open deployment (ww-backend #324,
     * `deployments_one_open_per_device`), and a push that creates the next one
     * while another is open is refused with 23P01. The scanner already sends a
     * camera with an open deployment on this phone to End Deployment; this
     * covers one started by someone else, or on another phone and not pulled.
     *
     * It sees only what this account may read: deployments in projects where
     * it holds a role, an organisation it manages, or everything for a
     * ww_admin. "none" means none of those. A deployment in any other project
     * is invisible here, and the server's refusal is then the only word on it.
     *
     * Never blocks on the network: offline, failed or slower than
     * OPEN_DEPLOYMENT_CHECK_MS, the answer is "unchecked" with a warning.
     */
    checkServerForOpenDeployment: async (deviceId: string, userId: string): Promise<OpenDeploymentCheck> => {
        if (!deviceId || await isKnownOffline()) return { kind: 'unchecked', message: UNCHECKED_WARNING }

        let timer: ReturnType<typeof setTimeout> | undefined
        const timedOut = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new TypeError(`Network request timed out after ${OPEN_DEPLOYMENT_CHECK_MS / 1000} s`)),
                OPEN_DEPLOYMENT_CHECK_MS,
            )
        })
        try {
            const message = await Promise.race([describeOpenDeploymentElsewhere(deviceId, userId), timedOut])
            if (!message) {
                log('[DeploymentService] No open deployment this account can see on device', deviceId)
                return { kind: 'none' }
            }
            log('[DeploymentService] Open deployment on the server for device', deviceId)
            return { kind: 'open', message }
        } catch (error) {
            logCloudFailure('[DeploymentService] Could not ask the server about open deployments on this camera:', error)
            return { kind: 'unchecked', message: UNCHECKED_WARNING }
        } finally {
            clearTimeout(timer)
        }
    },

    /**
     * Observe all deployments (sorted by creation date)
     */
    observeDeployments: () => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        return deploymentsCollection.query(
            Q.sortBy('created_at', Q.desc)
        ).observe()
    },

    /**
     * Observe deployments filtered to a specific organisation.
     * Joins through projects table to find deployments whose project belongs to the given org.
     */
    observeDeploymentsForOrganisation: (organisationId: string) => {
        const deploymentsCollection = database.get<Deployment>('deployments')
        return deploymentsCollection.query(
            Q.on('projects', 'organisation_id', organisationId),
            Q.sortBy('created_at', Q.desc)
        ).observe()
    },

    /**
     * Get deployments that the user has access to
     */
    getDeploymentsForUser: async (userId: string): Promise<Deployment[]> => {
        const userProjects = await ProjectService.getProjectsForUser(userId)
        const projectIds = new Set(userProjects.map((p: any) => p.id))

        if (projectIds.size === 0) {
            // Check global admin
            const userRolesCollection = database.get('user_roles')
            const userRoles = await userRolesCollection.query(
                Q.where('user_id', userId),
                Q.where('is_active', true)
            ).fetch()

            // A ww_admin, or a manager at system scope, sees every deployment (#351)
            if (seesEverything(userRoles as any)) {
                const deploymentsCollection = database.get<Deployment>('deployments')
                return await deploymentsCollection.query(Q.sortBy('created_at', Q.desc)).fetch()
            }
            return []
        }

        const deploymentsCollection = database.get<Deployment>('deployments')
        return await deploymentsCollection.query(
            Q.where('project_id', Q.oneOf(Array.from(projectIds) as string[])),
            Q.sortBy('created_at', Q.desc)
        ).fetch()
    },

    /**
     * Get deployments for user in a specific organisation
     */
    getDeploymentsForUserInOrganisation: async (userId: string, organisationId: string): Promise<Deployment[]> => {
        const userProjects = await ProjectService.getProjectsForUserInOrganisation(userId, organisationId)
        const projectIds = new Set(userProjects.map((p: any) => p.id))

        if (projectIds.size === 0) {
            // Check global/org admin
            const userRolesCollection = database.get('user_roles')
            const userRoles = await userRolesCollection.query(
                Q.where('user_id', userId),
                Q.where('is_active', true)
            ).fetch()

            const hasFullAccess = seesOrganisation(userRoles as any, organisationId)

            if (hasFullAccess) {
                const deploymentsCollection = database.get<Deployment>('deployments')
                return await deploymentsCollection.query(
                    Q.on('projects', 'organisation_id', organisationId),
                    Q.sortBy('created_at', Q.desc)
                ).fetch()
            }
            return []
        }

        const deploymentsCollection = database.get<Deployment>('deployments')
        return await deploymentsCollection.query(
            Q.where('project_id', Q.oneOf(Array.from(projectIds) as string[])),
            Q.sortBy('created_at', Q.desc)
        ).fetch()
    }
}

/**
 * The operator's message for an open deployment on the server that this phone
 * does not hold, or holds and has not ended, or null when there is none this
 * account can see. A failed read throws.
 */
async function describeOpenDeploymentElsewhere(deviceId: string, userId: string): Promise<string | null> {
    const client = getSupabaseClient()
    const { data, error } = await client
        .from('deployments')
        .select('id, project_id, setup_by, deployment_start')
        .eq('device_id', deviceId)
        .is('deployment_end', null)
        .is('deleted_at', null)
    if (error) throw error
    if (!data || data.length === 0) return null

    // One this phone has ended, the end not uploaded yet, is not in the way:
    // the outbox sends the end before the new deployment or in the same
    // push_changes call, and the constraint is checked at commit.
    const here = await database.get<Deployment>('deployments')
        .query(Q.where('id', Q.oneOf(data.map(row => row.id))))
        .fetch()
    const endedHere = new Set(here.filter(d => d.deploymentStatusId === DEPLOYMENT_STATUS.ENDED).map(d => d.id))
    const open = data.find(row => !endedHere.has(row.id))
    if (!open) return null

    // Whoever can read a deployment can read its project. Another person's
    // name comes only from get_project_members, which answers a member of
    // the project and no one else, so it may be missing.
    const { data: project } = await client.from('projects').select('name').eq('id', open.project_id).maybeSingle()
    let startedBy: string | null = null
    if (open.setup_by === userId) {
        startedBy = 'you'
    } else if (open.setup_by) {
        const { data: members } = await client.rpc('get_project_members', { p_project_id: open.project_id })
        startedBy = members?.find(member => member.id === open.setup_by)?.name?.trim() || null
    }

    const where = project?.name ? `"${project.name}"` : 'another project'
    const by = startedBy ? ` by ${startedBy}` : ''
    const on = open.deployment_start ? ` on ${new Date(open.deployment_start).toLocaleDateString()}` : ''
    return `This camera is still deployed in ${where}, started${by}${on}. That deployment has to be ended before the camera can be deployed again.`
}

/**
 * Prepare a change to a deployment, and its outbox UPDATE carrying only the
 * columns the change touched (#411), for the caller to batch. push_changes
 * keeps any column an update leaves out (ww-backend #172). The whole record
 * let a phone holding an older copy put the old location_name, latitude and
 * longitude back over a website edit when it ended the deployment or swapped
 * in a photo path, since the push runs before the pull.
 */
export function prepareDeploymentUpdate(
    deployment: Deployment,
    userId: string,
    change: (record: Deployment) => void,
): [Deployment, SyncOutbox] {
    const before = mapModelToPayload(deployment)
    // prepareUpdate applies the change to the record at once, and stamps updated_at
    const updateOp = deployment.prepareUpdate(change)
    const after = mapModelToPayload(deployment)
    const changed = Object.fromEntries(
        Object.entries(after).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]))
    )
    const outboxOp = OutboxService.recordOperation({
        operation: 'UPDATE',
        tableName: 'deployments',
        recordId: deployment.id,
        payload: { ...changed, id: deployment.id, updated_at: after.updated_at },
        userId,
    })
    return [updateOp, outboxOp]
}

/**
 * Helper to map model to plain object for sync (snake_case): the whole
 * record, for a CREATE. An update sends only what it changed, through
 * prepareDeploymentUpdate.
 */
export function mapModelToPayload(model: Deployment): any {
    return {
        id: model.id,
        project_id: model.projectId,
        // user_id: model.userId, // REMOVED
        device_id: model.deviceId,
        name: model.name,
        setup_by: model.setupBy,
        deployment_start: new Date(model.deploymentStart).toISOString(),
        ended_by: model.endedBy || null,
        deployment_end: (model.deploymentEnd && model.deploymentEnd.getTime() > 1000) ? new Date(model.deploymentEnd).toISOString() : null,
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
        camera_location_image_paths: (model.cameraLocationImagePaths && typeof model.cameraLocationImagePaths === 'string')
            ? JSON.parse(model.cameraLocationImagePaths)
            : (model.cameraLocationImagePaths || null),
        latitude: model.latitude || null,
        longitude: model.longitude || null,

        // Device Snapshot Fields
        camera_model: model.cameraModel || null,
        lorawan_network: model.lorawanNetwork || null,
        device_eui: model.deviceEui || null,
        lorawan_registration_completed: model.lorawanRegistrationCompleted || false,
        lorawan_last_verified_at: model.lorawanLastVerifiedAt ? new Date(model.lorawanLastVerifiedAt).toISOString() : null,
        ai_model_id: model.aiModelId || null,
        ble_firmware_id: model.bleFirmwareId || null,
        himax_firmware_id: model.himaxFirmwareId || null,
        battery_level_at_start: model.batteryLevelAtStart ?? null,
        sd_card_total_kb_at_start: model.sdCardTotalKbAtStart ?? null,
        sd_card_available_kb_at_start: model.sdCardAvailableKbAtStart ?? null,
        lorawan_rssi_at_start: model.lorawanRssiAtStart ?? null,
        lorawan_snr_at_start: model.lorawanSnrAtStart ?? null,

        created_at: new Date(model.createdAt).toISOString(),
        updated_at: new Date(model.updatedAt).toISOString(),
        deleted_at: model.deletedAt ? new Date(model.deletedAt).toISOString() : null,
    }
}
