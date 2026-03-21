import { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../../../services/DeploymentService'
import { log, logError, logWarn } from '../../../utils/logger'

interface UseEndDeploymentParams {
    deployment: any
    user: any
    storeDevice: any
    retrievalNotes: string
    navigation: any
    quiesceDevice: (source: string, fast?: boolean, cachedOps?: string[] | null) => Promise<void>
    setDeploymentIdAsOps: (device: any, id: string | null, cachedOps?: string[] | null) => Promise<void>
    clearGpsLocation: (device: any) => Promise<void>
    runDisconnect: (device: any) => Promise<void>
    getAllOperationalParams: (device: any) => Promise<string[] | null>
    isNavigatingAway: React.MutableRefObject<boolean>
}

export const useEndDeployment = ({
    deployment,
    user,
    storeDevice,
    retrievalNotes,
    navigation,
    quiesceDevice,
    setDeploymentIdAsOps,
    clearGpsLocation,
    runDisconnect,
    getAllOperationalParams,
    isNavigatingAway
}: UseEndDeploymentParams) => {
    const [isEnding, setIsEnding] = useState(false)
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isEndDeploymentSuccess, setIsEndDeploymentSuccess] = useState(false)

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
                            setFinishStep('Force ending...')
                            setFinishLogs(['Device disconnected'])
                            addFinishLog('WARNING: Ending deployment without device connection')
                            
                            try {
                                const userId = user?.id || null
                                await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
                                addFinishLog('Deployment ended in database')
                                setFinishProgress(1.0)
                                setIsEndDeploymentSuccess(true)
                            } catch (e) {
                                setIsFinishing(false)
                                Alert.alert('Error', 'Failed to force end')
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
        setFinishStep('Starting...')
        setFinishLogs([])
        setIsEndDeploymentSuccess(false)

        try {
            // Pre-fetch all ops once for the entire end-deployment sequence
            let cachedOps: string[] | null = null
            if (storeDevice) {
                try {
                    cachedOps = await getAllOperationalParams(storeDevice)
                    log('[EndDeployment] Pre-fetched bulk ops for end-deployment')
                } catch (err) {
                    logWarn('[EndDeployment] Bulk ops fetch failed, proceeding without cache', err)
                }
            }

            // 1. Clear Configuration (ID)
            if (storeDevice) {
                addFinishLog('Clearing configuration...')
                setFinishStep('Clearing config...')
                setFinishProgress(0.2)
                
                log('[EndDeployment] Clearing Deployment ID...')
                let idCleared = false
                let attempts = 0
                while (!idCleared && attempts < 3) {
                    try {
                        attempts++
                        await setDeploymentIdAsOps(storeDevice, null, cachedOps)
                        log('[EndDeployment] ID cleared')
                        idCleared = true
                        addFinishLog('Configuration cleared')
                    } catch (e) {
                        logWarn(`[EndDeployment] Clear ID failed (attempt ${attempts}):`, e)
                        if (attempts < 3) {
                            addFinishLog(`Retry ${attempts}/3...`)
                            await new Promise(r => setTimeout(r, 1000))
                        }
                    }
                }

                if (!idCleared) addFinishLog('Warning: Config clear failed')

                // 2. Clear GPS (Legacy/Safety)
                try {
                    await clearGpsLocation(storeDevice)
                } catch (e) {
                    logWarn('[EndDeployment] Failed to clear GPS:', e)
                }
            }

            // 2. Update DB
            addFinishLog('Updating deployment record...')
            setFinishStep('Updating record...')
            setFinishProgress(0.3)
            
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
            addFinishLog('Record updated successfully')

            // 3. Quiesce Device (Final Stop) - Optimized mode skips camera enable
            if (storeDevice) {
                addFinishLog('Finalizing stop...')
                setFinishStep('Finalizing...')
                setFinishProgress(0.6)
                
                try {
                    await quiesceDevice('[EndDeployment]', true, cachedOps)  // Use optimized mode (skip camera enable)
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
            
            if (storeDevice) {
                try {
                    await runDisconnect(storeDevice)
                    addFinishLog('Device disconnected')
                } catch (e) {
                    logWarn('[EndDeployment] Disconnect error:', e)
                }
            }

            // Success State
            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsEndDeploymentSuccess(true)
            addFinishLog('Deployment ended successfully')

        } catch (error) {
            logError(error)
            setIsFinishing(false)
            Alert.alert("Error", "Failed to end deployment. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }, [storeDevice, user, deployment.id, retrievalNotes, quiesceDevice, setDeploymentIdAsOps, clearGpsLocation, runDisconnect, addFinishLog, isNavigatingAway, getAllOperationalParams])

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
