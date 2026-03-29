import { useState, useEffect, useRef } from 'react'
import { bleCommandManager } from '../../../ble/commandManager'
import { classifyForMonitor, MonitorEvent } from '../../../ble/messageClassifier'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBleHeartbeat } from '../../../hooks/useBleHeartbeat'

export interface ActivityLogEntry extends MonitorEvent {
    id: string
    timestamp: number
}

interface MonitorStats {
    photoCount: number
    motionCount: number
    timelapseCount: number
    timeActiveMs: number
}

const MAX_LOG_ENTRIES = 200

export const useDeploymentMonitor = (device: ExtendedPeripheral | null) => {
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
    const [stats, setStats] = useState<MonitorStats>({
        photoCount: 0,
        motionCount: 0,
        timelapseCount: 0,
        timeActiveMs: 0,
    })

    const startTimeRef = useRef<number>(Date.now())

    // 1. Keep the BLE connection alive using the heartbeat
    useBleHeartbeat(device)

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
        const handleRawMessage = (rawMessage: string) => {
            const classified = classifyForMonitor(rawMessage)
            if (!classified) return // Ignored message

            const newEntry: ActivityLogEntry = {
                ...classified,
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now(),
            }

            // Update the log (capped at MAX_LOG_ENTRIES)
            setActivityLog(prevLog => {
                const updatedLog = [newEntry, ...prevLog]
                return updatedLog.slice(0, MAX_LOG_ENTRIES)
            })

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

        bleCommandManager.addMessageListener(handleRawMessage)
        
        return () => {
            bleCommandManager.removeMessageListener(handleRawMessage)
        }
    }, [])

    return {
        activityLog,
        stats,
    }
}
