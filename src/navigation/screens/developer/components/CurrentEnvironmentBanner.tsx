import React from "react"
import { StyleSheet, Platform } from "react-native"
import { Surface, Text } from "react-native-paper"
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
					boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.15)",
				},
			]}
		>
			<WWText variant="labelMedium" style={styles.currentEnvironmentLabel}>
				<Text>🔌 ACTIVE ENVIRONMENT</Text>
			</WWText>
			<WWText variant="titleMedium" style={styles.currentEnvironmentName}>
				<Text>{ENVIRONMENT_CONFIGS[currentEnvironment].displayName}</Text>
			</WWText>
			<WWText variant="bodySmall" style={styles.currentEnvironmentUrl}>
				<Text>{ENVIRONMENT_CONFIGS[currentEnvironment].supabaseUrl}</Text>
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
