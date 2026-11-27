import { useState, useCallback, useRef, useEffect } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../../../services/DeploymentService'
import { endRefusal, END_REFUSED_TITLE } from '../../../services/deploymentAccess'
import { logError, logWarn } from '../../../utils/logger'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { QuiesceOptions } from '../../../hooks/useDeviceSettings'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'
import { END_DEPLOYMENT_CAMERA_COPY, END_DEPLOYMENT_NOT_ANSWERING_DISMISS_MS, endDeploymentSequence } from '../../../hooks/useMonitoringActions'

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

    // Why this account may not end the deployment, naming who can, or null
    // (#450). From the phone's roles, so offline too; the screen shows it
    // before Stop opens the notes, and the press asks again.
    const [endRefusalReason, setEndRefusalReason] = useState<string | null>(null)
    useEffect(() => {
        let isMounted = true
        if (!deployment?.projectId) return
        endRefusal(user?.id, { projectId: deployment.projectId, setupBy: deployment.setupBy })
            .then(reason => { if (isMounted) setEndRefusalReason(reason) })
            .catch(err => logWarn('[EndDeployment] Role check failed:', err))
        return () => { isMounted = false }
    }, [deployment?.projectId, deployment?.setupBy, user?.id])

    // Clean up navigation timer on unmount
    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current)
            }
        }
    }, [])

    const handleEndDeployment = useCallback(async () => {
        // Only its creator while a member, or a project admin, may end a
        // deployment, and the server refuses anyone else (ww-backend
        // 52_deployments.sql): the phone would show it ended while the server
        // and the website show it running. So anyone else is told who can,
        // before the camera is touched and before Force End is offered (#450).
        const refusal = await endRefusal(user?.id, { projectId: deployment.projectId, setupBy: deployment.setupBy })
        if (refusal) {
            setEndRefusalReason(refusal)
            Alert.alert(END_REFUSED_TITLE, refusal)
            return
        }

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
        progress.addLog('Preparing to stop monitoring...')

        try {
            // The camera's steps and the record's end, shared with the live
            // monitor's Stop Monitoring and the Dev Deployment Test (#557)
            const { cameraAnswered } = await endDeploymentSequence({
                bleDevice: storeDevice,
                deploymentId: deployment.id,
                userId: user?.id || null,
                notes: retrievalNotes,
                quiesceDevice,
                progress,
                disconnect: true,
            })

            // Success State
            progress.setFinishStep(cameraAnswered ? 'Complete' : END_DEPLOYMENT_CAMERA_COPY.finalStep)
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog(cameraAnswered ? 'Monitoring stopped successfully' : END_DEPLOYMENT_CAMERA_COPY.endedInApp)

            navigationTimerRef.current = setTimeout(() => {
                navigationTimerRef.current = null
                progress.setIsFinishing(false)
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                })
            }, cameraAnswered ? 1500 : END_DEPLOYMENT_NOT_ANSWERING_DISMISS_MS)

        } catch (error) {
            logError(error)
            progress.setIsFinishing(false)
            Alert.alert("Error", "Failed to stop monitoring. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }, [storeDevice, user, deployment.id, deployment.projectId, deployment.setupBy, retrievalNotes, quiesceDevice, progress, isNavigatingAway, navigation])

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
        endRefusalReason,
        handleEndDeployment,
        handleFinishDismiss
    }
}
