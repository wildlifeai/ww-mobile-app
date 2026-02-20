import { Alert, PermissionsAndroid, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import BleManager, { Peripheral } from 'react-native-ble-manager'
import ReferenceDataService from '../../../services/ReferenceDataService'
import { getSupabaseClient } from '../../../services/supabase'
import { DfuService } from '../../../services/DfuService'
import { log, logError, logWarn } from '../../../utils/logger'
import { ConsoleAction } from '../hooks/useConsoleReducer'

/**
 * Scans for the Nordic DFU booth loader which advertises as "DfuTarg"
 * after the device reboots into bootloader mode
 * @param timeoutMs How long to scan before giving up
 * @returns MAC address of the bootloader, or null if not found
 */
export const scanForBootloader = (timeoutMs: number = 10000): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>

        const eventEmitter = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                log('[scanForBootloader] Discovered:', peripheral.name, peripheral.id)

                // Check if this is the bootloader (WW500_DFU or DfuTarg)
                if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                    log('[scanForBootloader] Found bootloader at:', peripheral.id)
                    // Stop scanning
                    BleManager.stopScan().catch(err => logWarn('Failed to stop scan:', err))
                    // Remove listener
                    eventEmitter.remove()
                    // Clear timeout
                    if (timeout) clearTimeout(timeout)
                    // Return the address
                    resolve(peripheral.id)
                }
            }
        )

        // Start scanning
        BleManager.scan([], 5, true).catch(err => {
            logError('[scanForBootloader] Scan failed:', err)
            reject(err)
        })

        // Set timeout
        timeout = setTimeout(() => {
            log('[scanForBootloader] Scan timed out')
            BleManager.stopScan().catch(() => { })
            eventEmitter.remove()
            resolve(null)
        }, timeoutMs)
    })
}

export const handleFirmwareUpdate = async (
    device: any,
    dispatch: React.Dispatch<ConsoleAction>,
    write: (device: any, commands: any[]) => Promise<any>,
    disconnectDevice: (device: any) => Promise<void> | void
) => {
    try {
        dispatch({ type: 'APPEND_HISTORY', payload: {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'info',
            content: 'Starting Firmware Update...'
        }})

        // 1. Get latest firmware info
        const latestBleFirmware = await ReferenceDataService.getLatestFirmware('ble')
        if (!latestBleFirmware) throw new Error("No firmware found on server")

        // 2. Download
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.storage
            .from('firmware')
            .download(latestBleFirmware.locationPath)

        if (error || !data) throw new Error(`Download failed: ${error?.message}`)

        // 3. Save to file
        const localPath = FileSystem.cacheDirectory + 'last_image.jpg_' + Date.now() + '.zip'
        const reader = new FileReader()
        reader.readAsDataURL(data)
        reader.onloadend = async () => {
            const base64data = reader.result as string
            const base64Content = base64data.split(',')[1]

            await FileSystem.writeAsStringAsync(
                localPath,
                base64Content,
                { encoding: FileSystem.EncodingType.Base64, }
            )

            // 4. Trigger DFU Mode on device
            dispatch({ type: 'APPEND_HISTORY', payload: {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: `Sending 'dfu' command to switch mode...`
            }})

            // Send DFU command and wait for disconnect
            try {
                await write(device, ["dfu"])
                log('[EngineerConsole] DFU command sent, waiting for firmware to process...')

                // CRITICAL: Wait for firmware to receive and process the 'dfu' command
                await new Promise(resolve => setTimeout(resolve, 500))

                log('[EngineerConsole] Disconnecting to trigger DFU mode switch...')
                // CRITICAL: Device waits for disconnect to enter DFU mode
                await disconnectDevice(device)

                // Wait enough time for device to reboot into bootloader
                await new Promise(resolve => setTimeout(resolve, 5000))
            } catch (err) {
                logWarn("Failed to send DFU command or disconnect, attempting update anyway", err)
            }

            // 5. Request notification permission (required for foreground service on Android 14+)
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                    )
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        throw new Error('Notification permission required for firmware update')
                    }
                    log('[EngineerConsole] Notification permission granted')
                } catch (permErr) {
                    throw new Error(`Permission error: ${permErr}`)
                }
            }

            // 6. Scan for bootloader ("DfuTarg")
            dispatch({ type: 'APPEND_HISTORY', payload: {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: `Scanning for bootloader...`
            }})

            let bootloaderAddress: string | null = null
            try {
                bootloaderAddress = await scanForBootloader(10000) // 10s scan
                if (bootloaderAddress) {
                    log(`[EngineerConsole] Found bootloader at: ${bootloaderAddress}`)
                    dispatch({ type: 'APPEND_HISTORY', payload: {
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        type: 'info',
                        content: `Found bootloader: ${bootloaderAddress}`
                    }})
                } else {
                    throw new Error('Bootloader not found after scanning')
                }
            } catch (scanErr) {
                throw new Error(`Failed to find bootloader: ${scanErr}`)
            }

            // 7. Start DFU with bootloader address
            dispatch({ type: 'APPEND_HISTORY', payload: {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: `Starting DFU transfer to ${bootloaderAddress}...`
            }})

            await DfuService.startDFU(
                bootloaderAddress,
                localPath,
                (progress) => {
                    if (progress % 10 === 0) { // Log every 10%
                        dispatch({ type: 'APPEND_HISTORY', payload: {
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            type: 'info',
                            content: `DFU Progress: ${progress}%`
                        }})
                    }
                }
            )

            // 8. Update DB
            dispatch({ type: 'APPEND_HISTORY', payload: {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: `Firmware Update Complete!`
            }})

            await FileSystem.deleteAsync(localPath, { idempotent: true })
            Alert.alert('Success', 'Firmware updated successfully')
        }
    } catch (e) {
        dispatch({ type: 'APPEND_HISTORY', payload: {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'error',
            content: `DFU Failed: ${e}`
        }})
        Alert.alert('Error', `Update failed: ${e}`)
    }
}
