import { useState, useCallback, useRef, useEffect } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../../../services/DeploymentService'
import { log, logError, logWarn } from '../../../utils/logger'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { formatGPSString } from '../../../utils/gpsUtils'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { QuiesceOptions } from '../../../hooks/useDeviceSettings'

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
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isEndDeploymentSuccess, setIsEndDeploymentSuccess] = useState(false)
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clean up navigation timer on unmount
    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current)
            }
        }
    }, [])

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
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
                            setIsFinishing(true)
                            setFinishProgress(0.5)
                            setFinishStep('Force stopping...')
                            setFinishLogs(['Device disconnected'])
                            addFinishLog('WARNING: Stopping monitoring without device connection')
                            
                            try {
                                const userId = user?.id || null
                                await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
                                addFinishLog('Monitoring stopped in database')
                                setFinishProgress(1.0)
                                setIsEndDeploymentSuccess(true)
                            } catch (e) {
                                setIsFinishing(false)
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
        setIsFinishing(true)
        setFinishProgress(0)
        setFinishStep('Stopping...')
        setFinishLogs([])
        setIsEndDeploymentSuccess(false)

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
                addFinishLog('Clearing configuration...')
                setFinishStep('Clearing config...')
                setFinishProgress(0.2)
                
                log('[EndDeployment] Clearing Deployment ID...')
                try {
                    await session.execute(() => commandRegistry.setdid(null))
                    log('[EndDeployment] ID cleared')
                    addFinishLog('Configuration cleared')
                } catch (e) {
                    logWarn(`[EndDeployment] Clear ID failed:`, e)
                    addFinishLog('Warning: Config clear partially failed')
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
            addFinishLog('Updating monitoring record...')
            setFinishStep('Updating record...')
            setFinishProgress(0.3)
            
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
            addFinishLog('Record updated successfully')

            // 3. Quiesce Device (Final Stop)
            if (storeDevice && session) {
                addFinishLog('Finalizing stop...')
                setFinishStep('Finalizing...')
                setFinishProgress(0.6)
                
                try {
                    await quiesceDevice(storeDevice, { isEndDeployment: true, cachedOps, sessionScope: session })
                    addFinishLog('Device stopped')
                } catch (e) {
                    logWarn('[EndDeployment] Final stop warning:', e)
                    addFinishLog('Warning: Final stop incomplete')
                }
            }

            // 4. Disconnect
            addFinishLog('Disconnecting...')
            setFinishStep('Disconnecting...')
            setFinishProgress(0.8)
            
            if (storeDevice && session) {
                try {
                    await session.execute(commandRegistry.disconnect)
                    addFinishLog('Device disconnected')
                } catch (e) {
                    logWarn('[EndDeployment] Disconnect error:', e)
                }
            }

            // Success State
            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsEndDeploymentSuccess(true)
            addFinishLog('Monitoring stopped successfully')

            navigationTimerRef.current = setTimeout(() => {
                navigationTimerRef.current = null
                setIsFinishing(false)
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                })
            }, 1500)

        } catch (error) {
            logError(error)
            setIsFinishing(false)
            Alert.alert("Error", "Failed to stop monitoring. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }, [storeDevice, user, deployment.id, retrievalNotes, quiesceDevice, addFinishLog, isNavigatingAway, navigation])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isEndDeploymentSuccess) {
            // Reset navigation stack to Home
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
            })
        }
    }, [isEndDeploymentSuccess, navigation])

    return {
        isEnding,
        finishProgress,
        finishStep,
        finishLogs,
        isFinishing,
        isEndDeploymentSuccess,
        handleEndDeployment,
        handleFinishDismiss
    }
}
