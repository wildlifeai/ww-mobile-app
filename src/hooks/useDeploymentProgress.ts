import { useState, useCallback, useMemo } from 'react'

import { log } from '../utils/logger'

/**
 * useDeploymentProgress: shared progress dialog state machine.
 *
 * Used by useStartDeployment, useDevDeployment, and useEndDeployment
 * to drive their respective progress/finish dialogs with consistent
 * state management.
 */
export function useDeploymentProgress() {
    const [isFinishing, setIsFinishing] = useState(false)
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isSuccess, setIsSuccess] = useState(false)

    /**
     * Every line also goes to the logger.
     *
     * This log is what an operator reads when a deployment misbehaves, and it
     * used to live only in component state: the dialog auto-transitions to the
     * live monitor when the deployment finishes, and the whole account of what
     * happened went with it. Nothing could be recovered afterwards, from a
     * field report or from a bench capture. One line, and the same account is
     * in logcat beside the BLE traffic it describes.
     */
    const addLog = useCallback((msg: string) => {
        log(`[DeploymentLog] ${msg}`)
        setFinishLogs(prev => [...prev, msg])
    }, [])

    /** Reset all state and show the dialog */
    const reset = useCallback((initialStep: string = '') => {
        setIsFinishing(true)
        setFinishProgress(0)
        setFinishStep(initialStep)
        setFinishLogs([])
        setIsSuccess(false)
    }, [])

    return useMemo(() => ({
        isFinishing, setIsFinishing,
        finishProgress, setFinishProgress,
        finishStep, setFinishStep,
        finishLogs,
        isSuccess, setIsSuccess,
        addLog, reset,
    }), [isFinishing, finishProgress, finishStep, finishLogs, isSuccess, addLog, reset])
}

export type DeploymentProgress = ReturnType<typeof useDeploymentProgress>
