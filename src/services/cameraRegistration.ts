import Device from '../database/models/Device'
import { DeviceService } from './DeviceService'
import { log, logError } from '../utils/logger'

export const CANNOT_REGISTER_TITLE = 'Cannot register this camera'

export type CameraRegistration =
    | { kind: 'registered'; device: Device }
    | { kind: 'cancelled' }
    | { kind: 'failed' }

/**
 * Give the phone a row for a camera it has none for: the server's (#451), else
 * a new one. A camera belongs to no organisation since ww-backend #346 (#327):
 * every signed-in account but the demo one reads every camera and may register
 * one, so a field user invited to one project can register the camera in their
 * hand, and the server's row is found whenever there is one (#501).
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
    userId: string
    isCancelled?: () => boolean
    onStep?: (step: string) => unknown
}): Promise<CameraRegistration> {
    const { bluetoothId, name, userId, isCancelled, onStep } = args

    await onStep?.('Looking for this camera on the server...')
    const onServer = await DeviceService.adoptFromServer(bluetoothId)
    log(`Server lookup for ${bluetoothId}: ${onServer.kind}`)

    if (isCancelled?.()) return { kind: 'cancelled' }
    if (onServer.kind === 'found') return { kind: 'registered', device: onServer.device }

    log(`Registering camera ${bluetoothId} on this phone...`)
    try {
        const device = await DeviceService.createDevice(bluetoothId, name, userId)
        log(`Device created: ${device?.id}`)
        return { kind: 'registered', device }
    } catch (error) {
        logError('Error creating device in DB:', error)
        const existing = await DeviceService.getDeviceByBluetoothId(bluetoothId)
        return existing ? { kind: 'registered', device: existing } : { kind: 'failed' }
    }
}
