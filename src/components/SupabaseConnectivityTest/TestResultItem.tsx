import React from "react"
import { View, StyleSheet } from "react-native"
import { Card, Text, Chip, ActivityIndicator } from "react-native-paper"
import type { TestResult } from "../SupabaseConnectivityTest"

export interface TestResultItemProps {
	test: TestResult
}

export const TestResultItem: React.FC<TestResultItemProps> = ({ test }) => {
	const getStatusColor = (status: TestResult["status"]) => {
		switch (status) {
			case "success":
				return "#4CAF50"
			case "error":
				return "#F44336"
			case "running":
				return "#FF9800"
			default:
				return "#9E9E9E"
		}
	}

	const getStatusIcon = (status: TestResult["status"]) => {
		switch (status) {
			case "success":
				return "✅"
			case "error":
				return "❌"
			case "running":
				return "⏳"
			default:
				return "⚪"
		}
	}

	return (
		<Card style={styles.testCard}>
			<Card.Content>
				<View style={styles.testHeader}>
					<Text style={styles.testIcon}>{getStatusIcon(test.status)}</Text>
					<Text variant="titleMedium" style={styles.testName}>
						{test.name}
					</Text>
					{test.duration && (
						<Chip mode="outlined" compact>
							<Text>{test.duration}ms</Text>
						</Chip>
					)}
				</View>
				<Text
					style={[
						styles.testMessage,
						{ color: getStatusColor(test.status) },
					]}
				>
					{test.message}
				</Text>
				{test.status === "running" && (
					<ActivityIndicator size="small" style={styles.loader} />
				)}
			</Card.Content>
		</Card>
	)
}

const styles = StyleSheet.create({
	testCard: {
		marginBottom: 8,
	},
	testHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	testIcon: {
		fontSize: 20,
		marginRight: 8,
	},
	testName: {
		flex: 1,
	},
	testMessage: {
		fontSize: 12,
	},
	loader: {
		marginTop: 8,
	},
})
