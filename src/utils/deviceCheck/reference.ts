/**
 * The reference unit: what a known-good camera measured in this phone's
 * fixture, kept on the phone. The lens peak is only meaningful against a good
 * unit in the same jig, card and distance, so the operator records one, and
 * every later run compares with it.
 */
import { getStorageData, storeDataToStorage } from '../helpers'

const STORAGE_KEY = 'deviceCheck:reference'

export interface CheckReference {
    /** Lens position where the reference unit's photos were sharpest */
    lensPeak: number
    /** ISO time it was recorded, and from which camera */
    recordedAt: string
    deviceName: string
}

export const loadReference = (): Promise<CheckReference | null> => getStorageData<CheckReference>(STORAGE_KEY)

export const saveReference = (reference: CheckReference): Promise<void> =>
    storeDataToStorage(STORAGE_KEY, reference).then(() => undefined)
