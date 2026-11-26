import Device from '../database/models/Device'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import type { CommandContext } from '../ble/protocol/commandRegistry'
import { DeviceService } from './DeviceService'
import { log, logError, logWarn } from '../utils/logger'

export const CANNOT_REGISTER_TITLE = 'Cannot register this camera'

export type CameraRegistration =
    | { kind: 'registered'; device: Device }
    | { kind: 'cancelled' }
    | { kind: 'failed' }

/** The subset of a BLE session registration needs. `createBleSession` satisfies it. */
export interface RegistrationSession {
    execute: <T>(commandConstructor: () => CommandContext<T>) => Promise<T>
}

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
 * A new row carries the camera's DevEUI, read from `session` with `get deveui`,
 * because the server takes it on insert only and matches the camera's LoRaWAN
 * messages by it (#536). The server's row is taken as it is.
 *
 * `isCancelled` is asked between the server lookup and the local create, the
 * one point where the scanner can stop without having written anything.
 */
export async function registerCamera(args: {
    bluetoothId: string
    name: string
    userId: string
    session?: RegistrationSession
    isCancelled?: () => boolean
    onStep?: (step: string) => unknown
}): Promise<CameraRegistration> {
    const { bluetoothId, name, userId, session, isCancelled, onStep } = args

    await onStep?.('Looking for this camera on the server...')
    const onServer = await DeviceService.adoptFromServer(bluetoothId)
    log(`Server lookup for ${bluetoothId}: ${onServer.kind}`)

    if (isCancelled?.()) return { kind: 'cancelled' }
    if (onServer.kind === 'found') return { kind: 'registered', device: onServer.device }

    const deviceEui = session ? await readDeviceEui(session, bluetoothId) : undefined
    if (isCancelled?.()) return { kind: 'cancelled' }

    log(`Registering camera ${bluetoothId} on this phone...`)
    try {
        const device = await DeviceService.createDevice(bluetoothId, name, userId, deviceEui)
        log(`Device created: ${device?.id}`)
        return { kind: 'registered', device }
    } catch (error) {
        logError('Error creating device in DB:', error)
        const existing = await DeviceService.getDeviceByBluetoothId(bluetoothId)
        return existing ? { kind: 'registered', device: existing } : { kind: 'failed' }
    }
}

/**
 * The firmware's built-in DevEUI (ww-hardware se-identity.h, STATIC_DEVICE_EUI
 * 1): every camera reports it until it is given its own with `deveui`, so it
 * names no one camera. Recorded on two cameras, the server would link either's
 * messages to neither.
 */
const DEFAULT_DEVICE_EUI = '0080E10101010101'

/**
 * The camera's DevEUI, or undefined when it cannot be read: the camera is then
 * registered without one, as before #536. All zeros is a camera with no LoRaWAN
 * identity, and the firmware's default is shared by every camera not given its
 * own, so neither is recorded.
 */
async function readDeviceEui(session: RegistrationSession, bluetoothId: string): Promise<string | undefined> {
    try {
        const eui = await session.execute(commandRegistry.deveui)
        if (/^0+$/.test(eui) || eui === DEFAULT_DEVICE_EUI) {
            logWarn(`Camera ${bluetoothId} reports ${eui === DEFAULT_DEVICE_EUI ? "the firmware's default" : 'an all-zero'} DevEUI, registering it without one`)
            return undefined
        }
        log(`Camera ${bluetoothId} DevEUI: ${eui}`)
        return eui
    } catch (error) {
        logWarn(`Could not read the DevEUI of ${bluetoothId}, registering it without one:`, error)
        return undefined
    }
}
