import React, { useCallback } from "react"
import { View, StyleSheet, Platform } from "react-native"
import { List, Divider, RadioButton, Button } from "react-native-paper"
import { WWText } from "../../../../components/ui/WWText"
import { type SupabaseEnvironment, ENVIRONMENT_CONFIGS } from "../../../../config/environments"
import { ConnectionStatus, STATUS_INDICATORS } from "../DeveloperSettingsScreen"

export interface EnvironmentItemProps {
    env: SupabaseEnvironment
    currentEnvironment: SupabaseEnvironment
    selectedEnvironment: SupabaseEnvironment
    connectionStatus: ConnectionStatus
    onSelect: (env: SupabaseEnvironment) => void
    onTest: (env: SupabaseEnvironment) => void
    spacing: number
}

export const EnvironmentItem = React.memo(({ 
    env, 
    currentEnvironment, 
    selectedEnvironment, 
    connectionStatus, 
    onSelect, 
    onTest,
    spacing 
}: EnvironmentItemProps) => {
    const config = ENVIRONMENT_CONFIGS[env]
    const status = connectionStatus
    const statusIndicator = STATUS_INDICATORS[status]
    const isActive = env === currentEnvironment
    
    // Stable render functions
    const renderLeft = useCallback((props: any) => (
         <RadioButton.Android
             value={env}
             status={selectedEnvironment === env ? "checked" : "unchecked"}
             onPress={() => onSelect(env)}
             testID={`radio-${env}`}
             accessibilityLabel={`Select ${config.displayName}`}
             accessibilityRole="radio"
             {...props}
         />
    ), [env, selectedEnvironment, config.displayName, onSelect])

    const renderRight = useCallback((props: any) => (
         <View style={styles.environmentActions} {...props}>
             <WWText
                 testID={`connection-status-${env}`}
                 style={styles.statusIndicator}
                 accessibilityLabel={`Connection status: ${status}`}
             >
                 {statusIndicator}
             </WWText>
         </View>
    ), [env, status, statusIndicator])

    return (
        <View style={styles.environmentItem}>
            <List.Item
                title={
                    <View style={styles.environmentTitle}>
                        <WWText variant="bodyLarge">{config.displayName}</WWText>
                        {isActive && (
                            <View style={styles.activeBadge}>
                                <WWText style={styles.activeBadgeText}>ACTIVE</WWText>
                            </View>
                        )}
                    </View>
                }
                description={config.description}
                left={renderLeft}
                right={renderRight}
                onPress={() => onSelect(env)}
            />

            <View
                style={[
                    styles.environmentDetails,
                    { paddingHorizontal: spacing * 2 },
                ]}
            >
                <WWText variant="bodySmall" style={styles.urlText}>
                    URL: {config.supabaseUrl}
                </WWText>

                <Button
                    mode="outlined"
                    onPress={() => onTest(env)}
                    disabled={status === "testing"}
                    icon="wifi"
                    style={styles.testButton}
                    testID={`test-connection-${env}`}
                    accessibilityLabel={`Test connection to ${config.displayName}`}
                    accessibilityRole="button"
                >
                    {status === "testing" ? "Testing..." : "Test Connection"}
                </Button>
            </View>

            <Divider style={{ marginVertical: spacing }} />
        </View>
    )
})

const styles = StyleSheet.create({
	environmentItem: {
		marginBottom: 8,
	},
	activeBadge: {
		backgroundColor: "#4CAF50",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
	},
	activeBadgeText: {
		color: "white",
		fontSize: 10,
		fontWeight: "700",
	},
	environmentTitle: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	environmentDetails: {
		marginTop: 8,
		gap: 8,
	},
	environmentActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	statusIndicator: {
		fontSize: 24,
	},
	urlText: {
		opacity: 0.7,
		fontFamily: Platform.select({
			ios: "Courier",
			android: "monospace",
			default: "monospace",
		}),
	},
	testButton: {
		marginTop: 4,
	},
})
