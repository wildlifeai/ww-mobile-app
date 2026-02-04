/**
 * Developer Settings Screen
 *
 * Provides runtime environment switching interface for development builds.
 * Allows developers to switch between local, cloud-dev, and cloud-prod Supabase instances
 * with connection testing and app restart capabilities.
 *
 * Features:
 * - Environment selection via radio buttons
 * - Connection status indicators (🟢 Connected, 🟡 Testing, 🔴 Not Available)
 * - Test connection functionality
 * - App restart on environment change
 * - Production build safety (hidden in production)
 *
 * @see Task 2.1: Developer Settings Screen
 * @see @project-context/development-context/MVP2/implementation/execution/environment-switching/
 */

import React, { useState, useCallback, useEffect } from "react"
import { ScrollView, StyleSheet, View, Alert, Platform } from "react-native"
import {
	Surface,
	List,
	Divider,
	RadioButton,
	Button,
	ActivityIndicator,
} from "react-native-paper"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// Conditionally import expo-updates (may not be available in Expo Go)
let Updates: typeof import("expo-updates") | null = null
try {
	Updates = require("expo-updates")
} catch (e) {
	// expo-updates not available (Expo Go or development build without native module)
	logWarn("expo-updates not available - using manual restart instructions")
}

import { WWText } from "../../../components/ui/WWText"
import { useExtendedTheme } from "../../../theme"
import {
	type SupabaseEnvironment,
	ENVIRONMENT_CONFIGS,
	getDefaultEnvironment,
	getAvailableEnvironments,
} from "../../../config/environments"
import {
	getEnvironment,
	setEnvironment,
	canSwitchEnvironment,
} from "../../../config/EnvironmentManager"
import { reconnectSupabase } from "../../../services/supabase"
import { log, logError, logWarn } from '../../../utils/logger'


/**
 * Connection status for each environment
 */
type ConnectionStatus = "unknown" | "testing" | "connected" | "failed"

/**
 * Map of connection status to emoji indicators
 */
const STATUS_INDICATORS: Record<ConnectionStatus, string> = {
	unknown: "⚪",
	testing: "🟡",
	connected: "🟢",
	failed: "🔴",
}

/**
 * Developer Settings Screen Component
 *
 * IMPORTANT: This screen is only visible in development builds (__DEV__ === true).
 * In production builds, it shows a "Not Available" message.
 */
export const DeveloperSettingsScreen: React.FC = () => {
	const { appPadding, spacing } = useExtendedTheme()
	const { top } = useSafeAreaInsets()

	// Current environment from EnvironmentManager
	const [currentEnvironment, setCurrentEnvironment] =
		useState<SupabaseEnvironment>(getDefaultEnvironment())

	// Loading state for environment initialization
	const [isLoadingEnvironment, setIsLoadingEnvironment] = useState(true)

	// Selected environment (may differ from current until "Apply & Restart" is pressed)
	const [selectedEnvironment, setSelectedEnvironment] =
		useState<SupabaseEnvironment>(currentEnvironment)

	// Connection status for each environment
	const [connectionStatus, setConnectionStatus] = useState<
		Record<SupabaseEnvironment, ConnectionStatus>
	>({
		local: "unknown",
		"cloud-dev": "unknown",
		"cloud-prod": "unknown",
	})

	// Loading state during app restart
	const [isRestarting, setIsRestarting] = useState(false)

	// Check if we can switch environments (development builds only)
	const canSwitch = canSwitchEnvironment()

	// Get available environments
	const availableEnvironments = getAvailableEnvironments()

	// Load current environment from storage on mount
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
				// Fallback to default
				const defaultEnv = getDefaultEnvironment()
				setCurrentEnvironment(defaultEnv)
				setSelectedEnvironment(defaultEnv)
			} finally {
				setIsLoadingEnvironment(false)
			}
		}

		loadEnvironment()
	}, [])

	/**
	 * Test connection to a specific environment
	 *
	 * Attempts a basic Supabase health check query to verify connectivity
	 */
	const testConnection = useCallback(async (env: SupabaseEnvironment) => {
		// Set testing status
		setConnectionStatus((prev) => ({
			...prev,
			[env]: "testing",
		}))

		try {
			const config = ENVIRONMENT_CONFIGS[env]

			log(`🔍 [${env}] Testing connection...`)
			log(`🔍 [${env}] URL: ${config.supabaseUrl}`)
			log(`🔍 [${env}] Anon Key Length: ${config.supabaseAnonKey.length}`)
			log(
				`🔍 [${env}] Anon Key Prefix: ${config.supabaseAnonKey.substring(0, 20)}...`,
			)

			// Basic health check: attempt to query Supabase
			const testUrl = `${config.supabaseUrl}/rest/v1/`
			log(`🔍 [${env}] Test URL: ${testUrl}`)

			const response = await fetch(testUrl, {
				method: "HEAD",
				headers: {
					apikey: config.supabaseAnonKey,
					"Content-Type": "application/json",
				},
			})

			log(`📡 [${env}] Response Status: ${response.status}`)
			log(`📡 [${env}] Response OK: ${response.ok}`)
			log(`📡 [${env}] Response Headers:`, {
				contentType: response.headers.get("content-type"),
				server: response.headers.get("server"),
				"sb-gateway-version": response.headers.get("sb-gateway-version"),
			})

			if (response.ok) {
				log(`✅ [${env}] Connection successful!`)
				setConnectionStatus((prev) => ({
					...prev,
					[env]: "connected",
				}))
			} else {
				logError(
					`❌ [${env}] Connection failed with status ${response.status}`,
				)
				// Try to get response body for more details
				try {
					const responseText = await response.text()
					logError(`❌ [${env}] Response body:`, responseText)
				} catch {
					logError(`❌ [${env}] Could not read response body`)
				}

				setConnectionStatus((prev) => ({
					...prev,
					[env]: "failed",
				}))
			}
		} catch (error) {
			logError(`❌ [${env}] Connection test exception:`, {
				message: error instanceof Error ? error.message : "Unknown error",
				name: error instanceof Error ? error.name : "Unknown",
				stack: error instanceof Error ? error.stack : undefined,
				error: error,
			})
			setConnectionStatus((prev) => ({
				...prev,
				[env]: "failed",
			}))
		}
	}, [])

	/**
	 * Handle environment change and app restart
	 *
	 * Prompts user for confirmation, updates environment, and restarts the app
	 */
	const handleApplyAndRestart = useCallback(async () => {
		log("🔄 [Restart] Handle apply and restart called")
		log(`🔄 [Restart] Selected: ${selectedEnvironment}`)
		log(`🔄 [Restart] Current: ${currentEnvironment}`)

		if (selectedEnvironment === currentEnvironment) {
			log("⚠️ [Restart] No change - environments match")
			Alert.alert("No Change", "Selected environment is already active.")
			return
		}

		log("🔄 [Restart] Showing confirmation dialog")

		Alert.alert(
			"Restart Required",
			`Switch to ${ENVIRONMENT_CONFIGS[selectedEnvironment].displayName}?\n\n` +
			"The app will restart to apply the new environment configuration.",
			[
				{
					text: "Cancel",
					style: "cancel",
					onPress: () => {
						log("❌ [Restart] User cancelled restart")
					},
				},
				{
					text: "Restart",
					style: "default",
					onPress: async () => {
						try {
							log("🔄 [Restart] User confirmed restart")
							log("🔄 [Restart] Setting isRestarting to true")
							setIsRestarting(true)

							log("🔄 [Restart] Checking expo-updates availability")
							log(`🔄 [Restart] Updates object:`, Updates)
							log(
								`🔄 [Restart] reloadAsync available:`,
								!!Updates?.reloadAsync,
							)

							// Save environment selection to AsyncStorage
							log(
								`🔄 [Restart] Saving environment: ${selectedEnvironment}`,
							)
							await setEnvironment(selectedEnvironment)
							log("✅ [Restart] Environment saved to AsyncStorage")

							// Update local state to reflect the change
							setCurrentEnvironment(selectedEnvironment)

							// In development builds, Updates.reloadAsync() just reloads JS bundle
							// without reinitializing native modules or recreating Supabase client.
							// We need to manually trigger Supabase client recreation.
							log("🔄 [Restart] Triggering Supabase client recreation...")
							await reconnectSupabase()
							log("✅ [Restart] Supabase client recreated with new environment")

							// Stop loading spinner and show success
							setIsRestarting(false)

							Alert.alert(
								"Environment Switched",
								`Successfully switched to ${ENVIRONMENT_CONFIGS[selectedEnvironment].displayName}.\n\n` +
								`The app is now connected to:\n${ENVIRONMENT_CONFIGS[selectedEnvironment].supabaseUrl}`,
								[
									{
										text: "OK",
										style: "default",
										onPress: () => {
											log("✅ [Restart] Environment switch complete")
										},
									},
								],
							)
						} catch (error) {
							logError("❌ [Restart] Error during restart:", {
								message: error instanceof Error ? error.message : "Unknown error",
								name: error instanceof Error ? error.name : "Unknown",
								stack: error instanceof Error ? error.stack : undefined,
								error: error,
							})
							setIsRestarting(false)
							Alert.alert(
								"Restart Failed",
								`Failed to restart app: ${error instanceof Error ? error.message : "Unknown error"
								}`,
							)
						}
					},
				},
			],
		)
	}, [selectedEnvironment, currentEnvironment])

	/**
	 * Render environment selection item
	 */
	const renderEnvironmentItem = (env: SupabaseEnvironment) => {
		const config = ENVIRONMENT_CONFIGS[env]
		const status = connectionStatus[env]
		const statusIndicator = STATUS_INDICATORS[status]
		const isActive = env === currentEnvironment

		return (
			<View key={env} style={styles.environmentItem}>
				<List.Item
					title={
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<WWText variant="bodyLarge">{config.displayName}</WWText>
							{isActive && (
								<View style={styles.activeBadge}>
									<WWText style={styles.activeBadgeText}>ACTIVE</WWText>
								</View>
							)}
						</View>
					}
					description={config.description}
					left={() => (
						<RadioButton.Android
							value={env}
							status={selectedEnvironment === env ? "checked" : "unchecked"}
							onPress={() => setSelectedEnvironment(env)}
							testID={`radio-${env}`}
							accessibilityLabel={`Select ${config.displayName}`}
							accessibilityRole="radio"
						/>
					)}
					right={() => (
						<View style={styles.environmentActions}>
							<WWText
								testID={`connection-status-${env}`}
								style={styles.statusIndicator}
								accessibilityLabel={`Connection status: ${status}`}
							>
								{statusIndicator}
							</WWText>
						</View>
					)}
					onPress={() => setSelectedEnvironment(env)}
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
						onPress={() => testConnection(env)}
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
	}

	// Production build - show not available message
	if (!canSwitch) {
		return (
			<ScrollView style={styles.container}>
				<Surface
					style={[
						styles.surface,
						{ padding: appPadding, paddingTop: appPadding + top },
					]}
				>
					<View style={[styles.header, { marginBottom: spacing * 2 }]}>
						<WWText variant="titleLarge">Developer Settings</WWText>
					</View>

					<View style={styles.notAvailableContainer}>
						<WWText variant="bodyLarge" style={styles.notAvailableText}>
							Developer settings are not available in production builds.
						</WWText>
						<WWText variant="bodyMedium" style={styles.notAvailableSubtext}>
							This feature is only accessible in development builds for testing
							and debugging purposes.
						</WWText>
					</View>
				</Surface>
			</ScrollView>
		)
	}

	// Development build - show full interface
	return (
		<ScrollView style={styles.container}>
			<Surface
				style={[
					styles.surface,
					{ padding: appPadding, paddingTop: appPadding + top },
				]}
			>
				<View style={[styles.header, { marginBottom: spacing * 2 }]}>
					<WWText variant="titleLarge">Developer Settings</WWText>
					<WWText variant="bodyMedium" style={styles.subtitle}>
						Runtime Environment Switching
					</WWText>
				</View>

				{/* Current Environment Indicator */}
				<Surface
					style={[
						styles.currentEnvironmentBanner,
						{
							marginHorizontal: spacing * 2,
							marginBottom: spacing * 2,
							padding: spacing * 2,
						},
					]}
					elevation={2}
				>
					<WWText variant="labelMedium" style={styles.currentEnvironmentLabel}>
						🔌 ACTIVE ENVIRONMENT
					</WWText>
					<WWText variant="titleMedium" style={styles.currentEnvironmentName}>
						{ENVIRONMENT_CONFIGS[currentEnvironment].displayName}
					</WWText>
					<WWText variant="bodySmall" style={styles.currentEnvironmentUrl}>
						{ENVIRONMENT_CONFIGS[currentEnvironment].supabaseUrl}
					</WWText>
				</Surface>

				<List.Section>
					<List.Subheader>Environment Selection</List.Subheader>

					<RadioButton.Group
						onValueChange={(value) =>
							setSelectedEnvironment(value as SupabaseEnvironment)
						}
						value={selectedEnvironment}
					>
						{availableEnvironments.map(renderEnvironmentItem)}
					</RadioButton.Group>
				</List.Section>

				<View
					style={[
						styles.actionsContainer,
						{ paddingHorizontal: spacing * 2, gap: spacing },
					]}
				>
					<WWText variant="bodySmall" style={styles.warningText}>
						⚠️ App restart required to apply environment changes
					</WWText>

					{isRestarting && (
						<View style={styles.loadingContainer} testID="loading-indicator">
							<ActivityIndicator size="large" />
							<WWText variant="bodyMedium" style={{ marginTop: spacing }}>
								Restarting app...
							</WWText>
						</View>
					)}

					<Button
						mode="contained"
						onPress={handleApplyAndRestart}
						disabled={
							selectedEnvironment === currentEnvironment || isRestarting
						}
						icon="restart"
						style={styles.applyButton}
						testID="apply-restart-button"
						accessibilityLabel="Apply environment change and restart app"
						accessibilityRole="button"
						accessibilityState={{
							disabled:
								selectedEnvironment === currentEnvironment || isRestarting,
						}}
					>
						Apply & Restart
					</Button>
				</View>

				<Divider style={{ marginVertical: spacing * 2 }} />

				<View style={[styles.footer, { marginTop: spacing }]}>
					<WWText variant="bodySmall" style={styles.footerText}>
						💡 This screen is only visible in development builds
					</WWText>
				</View>
			</Surface>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	surface: {
		flex: 1,
	},
	header: {
		alignItems: "center",
	},
	subtitle: {
		marginTop: 8,
		opacity: 0.7,
	},
	currentEnvironmentBanner: {
		borderRadius: 8,
		backgroundColor: "rgba(76, 175, 80, 0.1)", // Light green tint
		borderLeftWidth: 4,
		borderLeftColor: "#4CAF50", // Green accent
	},
	currentEnvironmentLabel: {
		fontWeight: "700",
		color: "#4CAF50",
		marginBottom: 4,
	},
	currentEnvironmentName: {
		fontWeight: "700",
		marginBottom: 4,
	},
	currentEnvironmentUrl: {
		opacity: 0.7,
		fontFamily: Platform.select({
			ios: "Courier",
			android: "monospace",
			default: "monospace",
		}),
	},
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
	infoText: {
		marginBottom: 16,
		fontWeight: "600",
	},
	actionsContainer: {
		marginTop: 16,
	},
	warningText: {
		textAlign: "center",
		opacity: 0.7,
		fontStyle: "italic",
	},
	loadingContainer: {
		alignItems: "center",
		paddingVertical: 16,
	},
	applyButton: {
		marginTop: 8,
	},
	footer: {
		alignItems: "center",
		paddingVertical: 16,
	},
	footerText: {
		textAlign: "center",
		opacity: 0.5,
	},
	notAvailableContainer: {
		alignItems: "center",
		paddingVertical: 32,
		paddingHorizontal: 16,
	},
	notAvailableText: {
		textAlign: "center",
		marginBottom: 16,
	},
	notAvailableSubtext: {
		textAlign: "center",
		opacity: 0.7,
	},
})
