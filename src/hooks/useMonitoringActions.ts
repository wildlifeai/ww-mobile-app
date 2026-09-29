import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Alert } from 'react-native'
import { DeploymentService } from '../services/DeploymentService'
import { createBleSession } from '../ble/session/createBleSession'
import { createEndDeploymentSession, EndDeploymentSession } from '../ble/session/endDeploymentSession'
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

interface EndDeploymentSequenceParams {
    bleDevice: ExtendedPeripheral | undefined
    deploymentId: string
    userId: string | null
    notes: string
    quiesceDevice: (device: ExtendedPeripheral, options?: QuiesceOptions) => Promise<void>
    progress: DeploymentProgress
    /** Drop the BLE link at the end. Stop Monitoring does; the Dev Deployment Test's End deployment stays connected. */
    disconnect: boolean
}

/**
 * What the operator is told when the camera does not answer while a deployment
 * ends (#293). Shared with Stop Monitoring's own copy of the sequence in
 * `useEndDeployment`.
 */
export const END_DEPLOYMENT_CAMERA_COPY = {
    step: 'Camera not answering',
    gaveUp: 'The camera did not answer. It is asleep or out of range, so the deployment ends without it.',
    notStopped: "Camera not stopped: it keeps this deployment's settings and goes on taking pictures",
    finalStep: 'Ended. The camera did not answer, so it keeps taking pictures',
    endedInApp: 'Deployment ended in the app',
}

/** How long the finished dialog stays up when it has that to say, against 1.5 s normally. */
export const END_DEPLOYMENT_NOT_ANSWERING_DISMISS_MS = 6000

/**
 * What ending a deployment means, on the device and in the database, in the
 * order Stop Monitoring has always done it: read the ops, clear the deployment
 * id and the GPS, end the record, quiesce, and disconnect when asked. Every
 * device step is best effort and logged; the record is the one step that
 * throws. Shared with the Dev Deployment Test's "End deployment" (22 September
 * 2026), which ends the deployment a device already carries and keeps the link
 * so a new one can be started straight after.
 *
 * The camera's steps share one budget and stop at the first one it does not
 * answer (`createEndDeploymentSession`, #293). Resolves `cameraAnswered: false`
 * when that happened, meaning the camera was left running.
 */
export async function endDeploymentSequence({
    bleDevice, deploymentId, userId, notes, quiesceDevice, progress, disconnect,
}: EndDeploymentSequenceParams): Promise<{ cameraAnswered: boolean }> {
    let cachedOps: string[] | null = null
    let session: EndDeploymentSession | null = null
    if (bleDevice) {
        try {
            progress.addLog('Reading device parameters...')
            session = createEndDeploymentSession(bleDevice, {
                onGiveUp: () => {
                    progress.setFinishStep(END_DEPLOYMENT_CAMERA_COPY.step)
                    progress.addLog(END_DEPLOYMENT_CAMERA_COPY.gaveUp)
                },
            })
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
    await DeploymentService.endDeployment(deploymentId, userId, notes)
    progress.addLog('Record updated successfully')

    // Quiesce device
    if (bleDevice && session) {
        progress.addLog('Finalizing stop...')
        progress.setFinishStep('Finalizing...')
        progress.setFinishProgress(0.6)
        try {
            await quiesceDevice(bleDevice, { isEndDeployment: true, cachedOps, sessionScope: session })
            progress.addLog(session.cameraNotAnswering() ? END_DEPLOYMENT_CAMERA_COPY.notStopped : 'Device stopped')
        } catch (e) {
            logWarn('[StopMonitoring] Final stop warning:', e)
            progress.addLog('Warning: Final stop incomplete')
        }
    }
    const cameraAnswered = !session?.cameraNotAnswering()

    // Disconnect
    if (!disconnect) return { cameraAnswered }
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
    return { cameraAnswered }
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
            const { cameraAnswered } = await endDeploymentSequence({
                bleDevice,
                deploymentId: deploymentIdRef.current,
                userId: userId || null,
                notes,
                quiesceDevice,
                progress,
                disconnect: true,
            })

            progress.setFinishStep(cameraAnswered ? 'Complete' : END_DEPLOYMENT_CAMERA_COPY.finalStep)
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog(cameraAnswered ? 'Monitoring stopped successfully' : END_DEPLOYMENT_CAMERA_COPY.endedInApp)

            navigationTimerRef.current = setTimeout(() => {
                navigationTimerRef.current = null
                progress.setIsFinishing(false)
                setIsMonitoring(false)
                isNavigatingAway.current = true
                navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
            }, cameraAnswered ? 1500 : END_DEPLOYMENT_NOT_ANSWERING_DISMISS_MS)

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
