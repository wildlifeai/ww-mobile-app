import { useState, useCallback, useEffect } from "react"
import { Alert } from "react-native"



import {
    type SupabaseEnvironment,
    ENVIRONMENT_CONFIGS,
    getDefaultEnvironment,
    getAvailableEnvironments,
} from "../../../../config/environments"
import {
    getEnvironment,
    setEnvironment,
    canSwitchEnvironment,
} from "../../../../config/EnvironmentManager"
import { reconnectSupabase } from "../../../../services/supabase"
import { log, logError } from '../../../../utils/logger'

export type ConnectionStatus = "unknown" | "testing" | "connected" | "failed"

export const STATUS_INDICATORS: Record<ConnectionStatus, string> = {
    unknown: "⚪",
    testing: "🟡",
    connected: "🟢",
    failed: "🔴",
}

export const useDeveloperSettings = () => {
    const [currentEnvironment, setCurrentEnvironment] =
        useState<SupabaseEnvironment>(() => getDefaultEnvironment())
    const [selectedEnvironment, setSelectedEnvironment] =
        useState<SupabaseEnvironment>(currentEnvironment)
    const [connectionStatus, setConnectionStatus] = useState<
        Record<SupabaseEnvironment, ConnectionStatus>
    >({
        local: "unknown",
        "cloud-dev": "unknown",
        "cloud-staging": "unknown",
        "cloud-prod": "unknown",
    })
    const [isRestarting, setIsRestarting] = useState(false)

    const canSwitch = canSwitchEnvironment()
    const availableEnvironments = getAvailableEnvironments()

    useEffect(() => {
        const loadEnvironment = async () => {
            log("📱 [DeveloperSettings] Loading current environment...")
            try {
                const env = await getEnvironment()
                log(`📱 [DeveloperSettings] Loaded environment: ${env}`)
                setCurrentEnvironment(env)
                setSelectedEnvironment(env)
            } catch (error) {
                logError("📱 [DeveloperSettings] Failed to load environment:", error)
                const defaultEnv = getDefaultEnvironment()
                setCurrentEnvironment(defaultEnv)
                setSelectedEnvironment(defaultEnv)
            }
        }

        loadEnvironment()
    }, [])

    const testConnection = useCallback(async (env: SupabaseEnvironment) => {
        setConnectionStatus((prev) => ({
            ...prev,
            [env]: "testing",
        }))

        try {
            const config = ENVIRONMENT_CONFIGS[env]
            log(`🔍 [${env}] Testing connection...`)
            log(`🔍 [${env}] URL: ${config.supabaseUrl}`)
            
            const testUrl = `${config.supabaseUrl}/rest/v1/`
            const response = await fetch(testUrl, {
                method: "HEAD",
                headers: {
                    apikey: config.supabaseAnonKey,
                    "Content-Type": "application/json",
                },
            })

            log(`📡 [${env}] Response Status: ${response.status}`)

            if (response.ok) {
                log(`✅ [${env}] Connection successful!`)
                setConnectionStatus((prev) => ({
                    ...prev,
                    [env]: "connected",
                }))
            } else {
                logError(`❌ [${env}] Connection failed with status ${response.status}`)
                setConnectionStatus((prev) => ({
                    ...prev,
                    [env]: "failed",
                }))
            }
        } catch (error) {
            logError(`❌ [${env}] Connection test exception:`, {
                message: error instanceof Error ? error.message : "Unknown error",
                name: error instanceof Error ? error.name : "Unknown",
            })
            setConnectionStatus((prev) => ({
                ...prev,
                [env]: "failed",
            }))
        }
    }, [])

    const handleApplyAndRestart = useCallback(async () => {
        log("🔄 [Restart] Handle apply and restart called")
        log(`🔄 [Restart] Selected: ${selectedEnvironment}`)

        if (selectedEnvironment === currentEnvironment) {
            log("⚠️ [Restart] No change - environments match")
            Alert.alert("No Change", "Selected environment is already active.")
            return
        }

        Alert.alert(
            "Restart Required",
            `Switch to ${ENVIRONMENT_CONFIGS[selectedEnvironment].displayName}?\n\n` +
            "The app will restart to apply the new environment configuration.",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => log("❌ [Restart] User cancelled restart"),
                },
                {
                    text: "Restart",
                    style: "default",
                    onPress: async () => {
                        try {
                            log("🔄 [Restart] User confirmed restart")
                            setIsRestarting(true)

                            log(`🔄 [Restart] Saving environment: ${selectedEnvironment}`)
                            await setEnvironment(selectedEnvironment)
                            
                            setCurrentEnvironment(selectedEnvironment)

                            log("🔄 [Restart] Triggering Supabase client recreation...")
                            await reconnectSupabase()
                            log("✅ [Restart] Supabase client recreated with new environment")

                            setIsRestarting(false)

                            Alert.alert(
                                "Environment Switched",
                                `Successfully switched to ${ENVIRONMENT_CONFIGS[selectedEnvironment].displayName}.\n\n` +
                                `The app is now connected to:\n${ENVIRONMENT_CONFIGS[selectedEnvironment].supabaseUrl}`,
                                [{ text: "OK", style: "default" }]
                            )
                        } catch (error) {
                            logError("❌ [Restart] Error during restart:", error)
                            setIsRestarting(false)
                            Alert.alert(
                                "Restart Failed",
                                `Failed to restart app: ${error instanceof Error ? error.message : "Unknown error"}`
                            )
                        }
                    },
                },
            ],
        )
    }, [selectedEnvironment, currentEnvironment])

    return {
        currentEnvironment,
        selectedEnvironment,
        setSelectedEnvironment,
        connectionStatus,
        isRestarting,
        canSwitch,
        availableEnvironments,
        testConnection,
        handleApplyAndRestart,
    }
}
