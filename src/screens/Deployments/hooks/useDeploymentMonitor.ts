import { useState, useEffect, useRef } from 'react'
import { classifyForMonitor, MonitorEvent } from '../../../ble/messageClassifier'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'


export interface ActivityLogEntry extends MonitorEvent {
    id: string
    timestamp: number
}

interface MonitorStats {
    photoCount: number
    motionCount: number
    timelapseCount: number
    timeActiveMs: number
    deviceImageCount: number | null  // From OP_PARAMETER.IMAGES_COUNT (firmware-reported total)
}

const MAX_LOG_ENTRIES = 200
const IMAGE_COUNT_POLL_INTERVAL_MS = 60000 // Poll every 60 seconds — frequent polling wakes AI processor from DPD and resets HM0360 MD

export const useDeploymentMonitor = (device: ExtendedPeripheral | null) => {
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
    const [stats, setStats] = useState<MonitorStats>({
        photoCount: 0,
        motionCount: 0,
        timelapseCount: 0,
        timeActiveMs: 0,
        deviceImageCount: null,
    })

    const startTimeRef = useRef<number>(Date.now())

    // 1. Poll IMAGES_COUNT from device periodically
    useEffect(() => {
        if (!device?.id || !device?.connected) return

        let isMounted = true
        const deviceRef = device

        const fetchImageCount = async () => {
            try {
                const session = createBleSession(deviceRef)
                const value = await session.execute(() => commandRegistry.getop(OP_PARAMETER.IMAGES_COUNT))
                if (value !== null && isMounted) {
                    const count = parseInt(value, 10)
                    if (!isNaN(count)) {
                        setStats(prev => ({ ...prev, deviceImageCount: count }))
                    }
                }
            } catch {
                // Silently ignore — device may be busy
            }
        }

        // Initial fetch after a short delay to let device settle into DPD first
        const initialTimeout = setTimeout(fetchImageCount, 5000)

        // Set up polling at the configured interval
        const intervalId = setInterval(fetchImageCount, IMAGE_COUNT_POLL_INTERVAL_MS)

        return () => {
            isMounted = false
            clearTimeout(initialTimeout)
            clearInterval(intervalId)
        }
    // Use stable references to avoid re-triggering on every Redux device update
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.id, device?.connected])

    // 2. Track time active
    useEffect(() => {
        const intervalId = setInterval(() => {
            setStats(prev => ({
                ...prev,
                timeActiveMs: Date.now() - startTimeRef.current
            }))
        }, 1000)
        return () => clearInterval(intervalId)
    }, [])

    // 3. Listen to raw BLE messages natively to parse activities
    useEffect(() => {
        const handleEvent = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return;
            const rawMessage = event.line;
            const classified = classifyForMonitor(rawMessage)
            if (!classified) return // Ignored message

            const newEntry: ActivityLogEntry = {
                ...classified,
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now(),
            }

            // Update the log (capped at MAX_LOG_ENTRIES) if not hidden
            if (!classified.isHidden) {
                setActivityLog(prevLog => {
                    const updatedLog = [newEntry, ...prevLog]
                    return updatedLog.slice(0, MAX_LOG_ENTRIES)
                })
            }

            // Update stats based on category
            setStats(prev => {
                const nextStats = { ...prev }
                
                if (classified.category === 'capture') {
                    // Try to extract the number from the label ("Captured X photos")
                    const match = classified.label.match(/\d+/)
                    if (match) {
                        nextStats.photoCount += parseInt(match[0], 10)
                    } else {
                        nextStats.photoCount += 1 // fallback
                    }
                } else if (classified.category === 'motion') {
                    nextStats.motionCount += 1
                } else if (classified.category === 'timelapse') {
                    nextStats.timelapseCount += 1
                }
                
                return nextStats
            })
        }

        bleEventBus.on('textLine', handleEvent)
        
        return () => {
            bleEventBus.removeListener('textLine', handleEvent)
        }
    }, [device])

    return {
        activityLog,
        stats,
    }
}
