import { useState, useCallback, useRef, useEffect } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../../../services/DeploymentService'
import { log, logError, logWarn } from '../../../utils/logger'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { formatGPSString } from '../../../utils/gpsUtils'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { QuiesceOptions } from '../../../hooks/useDeviceSettings'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'

interface UseEndDeploymentParams {
    deployment: any
    user: any
    storeDevice: ExtendedPeripheral | undefined
    retrievalNotes: string
    navigation: any
    quiesceDevice: (device: ExtendedPeripheral, options?: QuiesceOptions) => Promise<void>
    isNavigatingAway: React.MutableRefObject<boolean>
}

export const useEndDeployment = ({
    deployment,
    user,
    storeDevice,
    retrievalNotes,
    navigation,
    quiesceDevice,
    isNavigatingAway
}: UseEndDeploymentParams) => {
    const [isEnding, setIsEnding] = useState(false)
    const progress = useDeploymentProgress()
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clean up navigation timer on unmount
    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current)
            }
        }
    }, [])

    const handleEndDeployment = useCallback(async () => {
        // Sanity Check: Ensure BLE is still connected (unless it's a forced cleanup)
        if (!storeDevice || !storeDevice.connected) {
            Alert.alert(
                'Connection Lost',
                'The device appears to be disconnected. You cannot end the deployment on the device without a connection.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Force End (Database Only)',
                        style: 'destructive',
                        onPress: async () => {
                            // Allow forcing end if device is lost/damaged, but warn heavily
                            setIsEnding(true)
                            isNavigatingAway.current = true // Prevent alerts during force-end
                            progress.reset('Force stopping...')
                            progress.setFinishProgress(0.5)
                            progress.addLog('Device disconnected')
                            progress.addLog('WARNING: Stopping monitoring without device connection')
                            
                            try {
                                const userId = user?.id || null
                                await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
                                progress.addLog('Monitoring stopped in database')
                                progress.setFinishProgress(1.0)
                                progress.setIsSuccess(true)
                            } catch (e) {
                                progress.setIsFinishing(false)
                                Alert.alert('Error', 'Failed to force stop')
                            } finally {
                                setIsEnding(false)
                            }
                        }
                    }
                ]
            )
            return
        }

        // Reset and Show Progress Dialog
        setIsEnding(true)
        progress.reset('Stopping...')

        try {
            // Pre-fetch all ops once for the entire end-deployment sequence
            let cachedOps: string[] | null = null
            let session: any = null
            if (storeDevice) {
                try {
                    session = createBleSession(storeDevice)
                    cachedOps = await session.execute(commandRegistry.getops)
                    log('[EndDeployment] Pre-fetched bulk ops for end-deployment')
                } catch (err) {
                    logWarn('[EndDeployment] Bulk ops fetch failed, proceeding without cache', err)
                }
            }

            // 1. Clear Configuration (ID and GPS)
            if (storeDevice && session) {
                progress.addLog('Clearing configuration...')
                progress.setFinishStep('Clearing config...')
                progress.setFinishProgress(0.2)
                
                log('[EndDeployment] Clearing Deployment ID...')
                try {
                    await session.execute(() => commandRegistry.setdid(null))
                    log('[EndDeployment] ID cleared')
                    progress.addLog('Configuration cleared')
                } catch (e) {
                    logWarn(`[EndDeployment] Clear ID failed:`, e)
                    progress.addLog('Warning: Config clear partially failed')
                }

                // 2. Clear GPS (Legacy/Safety)
                try {
                    const gpsStr = formatGPSString(0, 0, 0)
                    await session.execute(() => commandRegistry.setgps(gpsStr))
                } catch (e) {
                    logWarn('[EndDeployment] Failed to clear GPS:', e)
                }
            }

            // 2. Update DB
            progress.addLog('Updating monitoring record...')
            progress.setFinishStep('Updating record...')
            progress.setFinishProgress(0.3)
            
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
            progress.addLog('Record updated successfully')

            // 3. Quiesce Device (Final Stop)
            if (storeDevice && session) {
                progress.addLog('Finalizing stop...')
                progress.setFinishStep('Finalizing...')
                progress.setFinishProgress(0.6)
                
                try {
                    await quiesceDevice(storeDevice, { isEndDeployment: true, cachedOps, sessionScope: session })
                    progress.addLog('Device stopped')
                } catch (e) {
                    logWarn('[EndDeployment] Final stop warning:', e)
                    progress.addLog('Warning: Final stop incomplete')
                }
            }

            // 4. Disconnect
            progress.addLog('Disconnecting...')
            progress.setFinishStep('Disconnecting...')
            progress.setFinishProgress(0.8)
            
            if (storeDevice && session) {
                try {
                    await session.execute(commandRegistry.disconnect)
                    progress.addLog('Device disconnected')
                } catch (e) {
                    logWarn('[EndDeployment] Disconnect error:', e)
                }
            }

            // Success State
            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Monitoring stopped successfully')

            navigationTimerRef.current = setTimeout(() => {
                navigationTimerRef.current = null
                progress.setIsFinishing(false)
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                })
            }, 1500)

        } catch (error) {
            logError(error)
            progress.setIsFinishing(false)
            Alert.alert("Error", "Failed to stop monitoring. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }, [storeDevice, user, deployment.id, retrievalNotes, quiesceDevice, progress, isNavigatingAway, navigation])

    const handleFinishDismiss = useCallback(() => {
        progress.setIsFinishing(false)
        if (progress.isSuccess) {
            // Reset navigation stack to Home
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
            })
        }
    }, [progress.isSuccess, navigation]) // eslint-disable-line react-hooks/exhaustive-deps

    return {
        isEnding,
        finishProgress: progress.finishProgress,
        finishStep: progress.finishStep,
        finishLogs: progress.finishLogs,
        isFinishing: progress.isFinishing,
        isEndDeploymentSuccess: progress.isSuccess,
        handleEndDeployment,
        handleFinishDismiss
    }
}
