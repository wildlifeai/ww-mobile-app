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

import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import {
	Surface,
	List,
	Divider,
	RadioButton,
	Button,
	ActivityIndicator,
} from "react-native-paper"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { WWText } from "../../../components/ui/WWText"
import { useExtendedTheme } from "../../../theme"
import {
	type SupabaseEnvironment,
} from "../../../config/environments"

import { EnvironmentItem } from "./components/EnvironmentItem"
import { CurrentEnvironmentBanner } from "./components/CurrentEnvironmentBanner"
import { useDeveloperSettings } from "./hooks/useDeveloperSettings"

/**
 * Developer Settings Screen Component
 *
 * IMPORTANT: This screen is only visible in development builds (__DEV__ === true).
 * In production builds, it shows a "Not Available" message.
 */
export const DeveloperSettingsScreen: React.FC = () => {
	const { appPadding, spacing } = useExtendedTheme()
	const { top } = useSafeAreaInsets()

	const {
		currentEnvironment,
		selectedEnvironment,
		setSelectedEnvironment,
		connectionStatus,
		isRestarting,
		canSwitch,
		availableEnvironments,
		testConnection,
		handleApplyAndRestart,
	} = useDeveloperSettings()

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
				<CurrentEnvironmentBanner 
					currentEnvironment={currentEnvironment} 
					spacing={spacing} 
				/>

				<List.Section>
					<List.Subheader>Environment Selection</List.Subheader>

					<RadioButton.Group
						onValueChange={(value) =>
							setSelectedEnvironment(value as SupabaseEnvironment)
						}
						value={selectedEnvironment}
					>
						{availableEnvironments.map(env => (
                            <EnvironmentItem
                                key={env}
                                env={env}
                                currentEnvironment={currentEnvironment}
                                selectedEnvironment={selectedEnvironment}
                                connectionStatus={connectionStatus[env] as "unknown" | "testing" | "connected" | "failed"}
                                onSelect={setSelectedEnvironment}
                                onTest={testConnection}
                                spacing={spacing}
                            />
                        ))}
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
