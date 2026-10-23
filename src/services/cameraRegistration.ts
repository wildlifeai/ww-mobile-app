import Device from '../database/models/Device'
import { DeviceService, ServerDeviceLookup } from './DeviceService'
import { log, logError } from '../utils/logger'

export const CANNOT_REGISTER_TITLE = 'Cannot register this camera'

/**
 * Why a camera neither on this phone nor readable on the server cannot be
 * registered by an account with no organisation. The server lets only a member
 * of the device's organisation insert it, and a project invitation grants no
 * organisation role.
 */
export const describeNoOrganisation = (lookup: ServerDeviceLookup['kind']): string => {
    const rule = 'Only a member of an organisation can register a new camera, and this account is not a member of one. Ask the organisation\'s manager to add you, or to register the camera.'
    return lookup === 'unchecked'
        ? `This phone could not ask the server about this camera. If it is already registered, try again with a connection. ${rule}`
        : rule
}

export type CameraRegistration =
    | { kind: 'registered'; device: Device }
    | { kind: 'no_organisation'; message: string }
    | { kind: 'cancelled' }
    | { kind: 'failed' }

/**
 * Give the phone a row for a camera it has none for: the server's, when this
 * account may read it (#451), else a new one in the current organisation. The
 * server is asked before the organisation is checked, so an account with no
 * organisation can still use a camera it may read.
 *
 * The scanner and the Dev Deployment Test both come here. The Engineer Console
 * connects without the scanner, so a camera met only through it has no row,
 * and a Dev Deployment Test of it was saved with no camera: never uploaded,
 * and never found again by the camera's id (#480). Only the phone's database
 * is written, never the camera.
 *
 * `isCancelled` is asked between the server lookup and the local create, the
 * one point where the scanner can stop without having written anything.
 */
export async function registerCamera(args: {
    bluetoothId: string
    name: string
    organisationId?: string | null
    userId: string
    isCancelled?: () => boolean
    onStep?: (step: string) => unknown
}): Promise<CameraRegistration> {
    const { bluetoothId, name, organisationId, userId, isCancelled, onStep } = args

    await onStep?.('Looking for this camera on the server...')
    const onServer = await DeviceService.adoptFromServer(bluetoothId)
    log(`Server lookup for ${bluetoothId}: ${onServer.kind}`)

    if (isCancelled?.()) return { kind: 'cancelled' }
    if (onServer.kind === 'found') return { kind: 'registered', device: onServer.device }

    if (!organisationId) {
        log(`No organisation, cannot register camera ${bluetoothId}`)
        return { kind: 'no_organisation', message: describeNoOrganisation(onServer.kind) }
    }

    log(`Creating device in DB for org ${organisationId}...`)
    try {
        const device = await DeviceService.createDevice(bluetoothId, name, organisationId, userId)
        log(`Device created: ${device?.id}`)
        return { kind: 'registered', device }
    } catch (error) {
        logError('Error creating device in DB:', error)
        const existing = await DeviceService.getDeviceByBluetoothId(bluetoothId)
        return existing ? { kind: 'registered', device: existing } : { kind: 'failed' }
    }
}
