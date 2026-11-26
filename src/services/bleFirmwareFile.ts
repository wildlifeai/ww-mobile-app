import { Platform } from 'react-native'
import DocumentPicker from 'react-native-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { logError } from '../utils/logger'

/** A Bluetooth firmware package picked on the phone, where the Nordic DFU library can read it */
export interface BleFirmwareFile {
    uri: string
    name: string
}

/**
 * Lets the engineer pick a Bluetooth firmware `.zip` from the phone, for a
 * build that is not in the catalogue. Android hands back a content URI the
 * DFU library cannot open, so the file is copied into the cache first.
 * Null when the picker is cancelled.
 */
export async function pickBleFirmwareFile(): Promise<BleFirmwareFile | null> {
    try {
        const [picked] = await DocumentPicker.pick({
            type: Platform.select({ ios: ['public.archive'], android: [DocumentPicker.types.allFiles] }),
        })
        const name = picked.name || 'firmware.zip'
        if (Platform.OS !== 'android') return { uri: picked.uri, name }
        const uri = `${FileSystem.cacheDirectory ?? ''}ble_firmware_${Date.now()}.zip`
        await FileSystem.copyAsync({ from: picked.uri, to: uri })
        return { uri, name }
    } catch (err) {
        if (DocumentPicker.isCancel(err)) return null
        throw err
    }
}

/** Deletes the cache copy an Android pick made; nothing to do on iOS */
export async function discardBleFirmwareFile(file: BleFirmwareFile): Promise<void> {
    if (Platform.OS !== 'android') return
    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(logError)
}
