import { useCallback, useState } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { OP_PARAMETER } from './useDeviceSettings'
import { log } from '../utils/logger'


export const useDeviceLatch = () => {
    const { setOperationalParam } = useBleCommands()
    const [isLatching, setIsLatching] = useState(false)

    /**
     * Triggers the DPD Latch Cycle:
     * 1. Wait for device to enter DPD (based on intervalBeforeDpd setting)
     * 2. Send Wake Up event (OP 19 = 0) to latch new settings
     * 3. Wait for stabilization
     */
    const triggerDpdLatch = useCallback(async (device: ExtendedPeripheral, logPrefix: string = '[DeviceLatch]') => {
        if (!device || !device.connected) {
            logWarn(`${logPrefix} Device not connected, skipping latch cycle.`)
            return
        }

        setIsLatching(true)
        try {
            log(`${logPrefix} Initiating DPD Latch Cycle to apply settings...`)

            // 1. ALLOW SLEEP: Wait for device to enter DPD
            // Standard timeout is usually 1000ms. We wait 2.5s to be safe.
            log(`${logPrefix} Waiting 2.5s for device to enter DPD...`)
            await new Promise(r => setTimeout(r, 2500))

            // 2. WAKE UP: Ping Himax to wake it. It should read the new config now.
            log(`${logPrefix} Waking Himax to latch configuration (OP ${OP_PARAMETER.WAKE_UP_EVENT})...`)
            try {
                await setOperationalParam(device, OP_PARAMETER.WAKE_UP_EVENT, '0')
            } catch (e) {
                logWarn(`${logPrefix} Failed to wake device (might already be awake?):`, e)
            }

            // 3. STABILIZE: Wait for it to wake and process
            log(`${logPrefix} Waiting 1.5s for stabilization...`)
            await new Promise(r => setTimeout(r, 1500))
            log(`${logPrefix} Latch cycle complete.`)

        } catch (error) {
            logError(`${logPrefix} Error during latch cycle:`, error)
            throw error
        } finally {
            setIsLatching(false)
        }
    }, [setOperationalParam])

    return {
        triggerDpdLatch,
        isLatching
    }
}
