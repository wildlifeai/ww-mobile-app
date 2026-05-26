import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../services/DeploymentService'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { formatGPSString } from '../utils/gpsUtils'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { QuiesceOptions } from './useDeviceSettings'
import { DeploymentProgress } from './useDeploymentProgress'
import { log, logError, logWarn } from '../utils/logger'

interface UseMonitoringActionsParams {
    bleDevice: ExtendedPeripheral | undefined
    disconnectDevice: (device: ExtendedPeripheral) => void | Promise<void>
    quiesceDevice: (device: ExtendedPeripheral, options?: QuiesceOptions) => Promise<void>
    userId: string | null | undefined
    navigation: any
    deploymentIdRef: React.MutableRefObject<string | null>
    isNavigatingAway: React.MutableRefObject<boolean>
    progress: DeploymentProgress
}

/**
 * useMonitoringActions — Shared monitoring lifecycle (disconnect-and-continue, stop).
 *
 * Used by useStartDeployment and useDevDeployment for the post-deployment
 * monitoring phase. Provides handleMonitorDisconnect (keep camera running)
 * and handleStopMonitoring (full teardown).
 */
export function useMonitoringActions({
    bleDevice,
    disconnectDevice,
    quiesceDevice,
    userId,
    navigation,
    deploymentIdRef,
    isNavigatingAway,
    progress,
}: UseMonitoringActionsParams) {
    const [isMonitoring, setIsMonitoring] = useState(false)
    const [isStoppingMonitoring, setIsStoppingMonitoring] = useState(false)
    const bleSession = bleDevice ? createBleSession(bleDevice) : null
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clean up timer on unmount to prevent state updates on dead components
    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
        }
    }, [])

    const handleMonitorDisconnect = useCallback(async () => {
        Alert.alert(
            'Wildlife Watcher Monitoring',
            'The bluetooth will be disconnected but the camera will continue monitoring for animals.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'default',
                    onPress: async () => {
                        try {
                            if (bleDevice) {
                                try { await bleSession?.execute(commandRegistry.disconnect) } catch {} finally { await disconnectDevice(bleDevice) }
                            }
                            setIsMonitoring(false)
                        } catch (error) {
                            logError('Monitor disconnect failed:', error)
                        } finally {
                            isNavigatingAway.current = true
                            navigation.navigate('Home', { initialTab: 'deployment' })
                        }
                    }
                }
            ]
        )
    }, [bleDevice, bleSession, disconnectDevice, navigation, isNavigatingAway])

    const handleStopMonitoring = useCallback(async (notes: string) => {
        if (!deploymentIdRef.current) {
            Alert.alert('Error', 'No active deployment found.')
            return
        }

        setIsStoppingMonitoring(true)
        progress.reset('Stopping...')
        progress.addLog('Preparing to stop monitoring...')

        try {
            let cachedOps: string[] | null = null
            let session: any = null
            if (bleDevice) {
                try {
                    progress.addLog('Reading device parameters...')
                    session = createBleSession(bleDevice)
                    cachedOps = await session.execute(commandRegistry.getops)
                    progress.addLog('Device parameters read')
                    log('[StopMonitoring] Pre-fetched bulk ops')
                } catch (err) {
                    logWarn('[StopMonitoring] Bulk ops fetch failed', err)
                    progress.addLog('Warning: Could not read device parameters')
                }
            }

            // Clear deployment ID on device
            if (bleDevice && session) {
                progress.addLog('Clearing configuration...')
                progress.setFinishStep('Clearing config...')
                progress.setFinishProgress(0.2)
                try {
                    await session.execute(() => commandRegistry.setdid(null))
                    log('[StopMonitoring] ID cleared')
                    progress.addLog('Configuration cleared')
                } catch (e) {
                    logWarn('[StopMonitoring] Clear ID failed:', e)
                    progress.addLog('Warning: Config clear partially failed')
                }

                // Clear GPS
                try {
                    const gpsStr = formatGPSString(0, 0, 0)
                    await session.execute(() => commandRegistry.setgps(gpsStr))
                } catch (e) {
                    logWarn('[StopMonitoring] Failed to clear GPS:', e)
                }
            }

            // Update DB
            progress.addLog('Updating monitoring record...')
            progress.setFinishStep('Updating record...')
            progress.setFinishProgress(0.3)
            await DeploymentService.endDeployment(deploymentIdRef.current, userId || null, notes)
            progress.addLog('Record updated successfully')

            // Quiesce device
            if (bleDevice && session) {
                progress.addLog('Finalizing stop...')
                progress.setFinishStep('Finalizing...')
                progress.setFinishProgress(0.6)
                try {
                    await quiesceDevice(bleDevice, { isEndDeployment: true, cachedOps, sessionScope: session })
                    progress.addLog('Device stopped')
                } catch (e) {
                    logWarn('[StopMonitoring] Final stop warning:', e)
                    progress.addLog('Warning: Final stop incomplete')
                }
            }

            // Disconnect
            progress.addLog('Disconnecting...')
            progress.setFinishStep('Disconnecting...')
            progress.setFinishProgress(0.8)
            if (bleDevice && session) {
                try {
                    await session.execute(commandRegistry.disconnect)
                    progress.addLog('Device disconnected')
                } catch (e) {
                    logWarn('[StopMonitoring] Disconnect error:', e)
                }
            }

            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Monitoring stopped successfully')

            navigationTimerRef.current = setTimeout(() => {
                navigationTimerRef.current = null
                progress.setIsFinishing(false)
                setIsMonitoring(false)
                isNavigatingAway.current = true
                navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
            }, 1500)

        } catch (error) {
            logError('[StopMonitoring] Failed:', error)
            progress.setIsFinishing(false)
            Alert.alert('Error', 'Failed to stop monitoring. Please try again.')
        } finally {
            setIsStoppingMonitoring(false)
        }
    }, [bleDevice, userId, navigation, quiesceDevice, deploymentIdRef, isNavigatingAway, progress])

    return useMemo(() => ({
        isMonitoring, setIsMonitoring,
        isStoppingMonitoring,
        handleMonitorDisconnect,
        handleStopMonitoring,
    }), [isMonitoring, isStoppingMonitoring, handleMonitorDisconnect, handleStopMonitoring])
}
