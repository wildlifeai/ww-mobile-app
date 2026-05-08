import { useState, useCallback, useMemo } from 'react'

/**
 * useDeploymentProgress — Shared progress dialog state machine.
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

    const addLog = useCallback((msg: string) => {
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
