import { Platform } from 'react-native'
import BleManager from 'react-native-ble-manager'
import { log } from '../../utils/logger'

/**
 * Android only: ask for the shortest connection interval while a photo comes
 * off the camera, and give it back after.
 *
 * Since BLE 0.30.57 (ww-hardware #34) the camera asks for 15 to 30 ms for the
 * length of a download, the widest range iPhones accept, and Android takes the
 * top of it: a 22 KB photo took 3.8 s at 30 ms (bench, 9 October 2026) and
 * 2.3 s at 15 ms (8 October), when the app's own request at connect still held.
 * High priority gets Android to the bottom of the range. iOS has no such call,
 * so there the camera's request is the only lever.
 *
 * Whichever request Android applies last wins, and the camera sends its own
 * when `txfile` arrives. Asked only before `txfile`, the link went to 15 ms and
 * then back to 30 ms (bench, 10 October 2026, 19.5 KB in 3.2 s). Asked only
 * after the camera's `N bytes in FILE` reply, 15 ms landed too late for a small
 * photo (3.5 s). Asked both early and again after that reply, the photo took
 * 2.0 s at 15 ms, twice. So callers ask early and again on the reply.
 *
 * Uploads make the same two calls in `runFileTransferPipeline`. A refused
 * request is not fatal: the photo still comes, only slower.
 */
export const requestFastInterval = async (deviceId: string): Promise<void> => {
    if (Platform.OS !== 'android') return
    try {
        await BleManager.requestConnectionPriority(deviceId, 1)
        log('[connectionPriority] Requested high connection priority for a download')
    } catch (e: any) {
        log(`[connectionPriority] requestConnectionPriority failed (non-fatal): ${e?.message ?? e}`)
    }
}

/** Back to balanced. Fire and forget: it rejects if the device already disconnected. */
export const releaseFastInterval = (deviceId: string): void => {
    if (Platform.OS !== 'android') return
    BleManager.requestConnectionPriority(deviceId, 0).catch(() => {})
}
