import AsyncStorage from '@react-native-async-storage/async-storage'

import type { HimaxUpdateRecord } from '../utils/himaxFirmwareState'
import { getStorageData, storeDataToStorage } from '../utils/helpers'
import { log, logWarn } from '../utils/logger'

const STORAGE_PREFIX = 'himaxUpdate:pending:'

const isVariant = (value: unknown): boolean => value === 'RP3' || value === 'HM0360'

const isRecord = (value: any): value is HimaxUpdateRecord =>
    !!value && isVariant(value.endVariant) && typeof value.sent === 'number' && typeof value.flashed === 'number'
    && Array.isArray(value.images) && value.images.length > 0
    && value.images.every((image: any) => isVariant(image?.variant) && typeof image?.version === 'string')

/**
 * A device's AI firmware pair update, on the phone that ran it (#374).
 *
 * The update writes the other camera's image first and the running camera's
 * last, and the camera starts each at its next boot, so an update cut short
 * between the two leaves the camera on the other camera. The camera cannot
 * say so afterwards (see `utils/himaxFirmwareState.ts`), so the update writes
 * down where it was going and how far it got, and Firmware Status, the update
 * screen and Start Monitoring read it back.
 *
 * - **Written before each `AI firmware`**, with `sent` already counting it: a
 *   write whose reply is lost may still have landed. `flashed` follows the OK.
 *   An update that stops before its first write leaves nothing behind.
 * - **Cleared** when the update's last check finds the camera on the end
 *   camera, or a later check finds it finished or never reached. Kept on a
 *   failure, which is what lets "Try again" and "Finish update" end on the
 *   right camera.
 * - **On this phone only.** Another phone, or this one after a reinstall, sees
 *   the camera alone, and an update cut short reads there as up to date or
 *   outdated by the running camera's build.
 */
export const himaxUpdateRecord = {
    async load(deviceId: string): Promise<HimaxUpdateRecord | null> {
        const stored = await getStorageData<unknown>(STORAGE_PREFIX + deviceId)
        if (stored == null) return null
        if (isRecord(stored)) return stored
        logWarn(`[HimaxUpdateRecord] ignoring an unreadable record for ${deviceId}`)
        return null
    },

    async save(deviceId: string, record: HimaxUpdateRecord): Promise<void> {
        await storeDataToStorage(STORAGE_PREFIX + deviceId, record)
        log(`[HimaxUpdateRecord] pending update recorded for ${deviceId}: ending on ${record.endVariant}, ${record.sent} sent, ${record.flashed} installed of ${record.images.length}`)
    },

    async clear(deviceId: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + deviceId)
            log(`[HimaxUpdateRecord] no pending update for ${deviceId}`)
        } catch (e) {
            logWarn('[HimaxUpdateRecord] could not clear the record:', e)
        }
    },
}
