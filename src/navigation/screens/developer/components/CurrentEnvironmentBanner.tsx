import React from "react"
import { View, StyleSheet, Platform } from "react-native"
import { Surface } from "react-native-paper"
import { WWText } from "../../../../components/ui/WWText"
import { type SupabaseEnvironment, ENVIRONMENT_CONFIGS } from "../../../../config/environments"

export interface CurrentEnvironmentBannerProps {
	currentEnvironment: SupabaseEnvironment
	spacing: number
}

export const CurrentEnvironmentBanner: React.FC<CurrentEnvironmentBannerProps> = ({
	currentEnvironment,
	spacing,
}) => {
	return (
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
	)
}

const styles = StyleSheet.create({
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
})
