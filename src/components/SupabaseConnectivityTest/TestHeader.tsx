import React from "react"
import { StyleSheet } from "react-native"
import { Card, Text, Button } from "react-native-paper"

export interface TestHeaderProps {
	isLoggedIn: boolean
	user: any
	isRunning: boolean
	runAllTests: () => Promise<void>
}

export const TestHeader: React.FC<TestHeaderProps> = ({
	isLoggedIn,
	user,
	isRunning,
	runAllTests,
}) => {
	return (
		<Card style={styles.card}>
			<Card.Title title="Test Suite" />
			<Card.Content>
				<Text>
					Authentication Status:{" "}
					{isLoggedIn ? "✅ Logged In" : "❌ Not Logged In"}
				</Text>
				<Text>User: {user?.email || "None"}</Text>
				<Button
					mode="contained"
					onPress={runAllTests}
					disabled={isRunning}
					style={styles.runButton}
				>
					{isRunning ? "Running Tests..." : "Run All Tests"}
				</Button>
			</Card.Content>
		</Card>
	)
}

const styles = StyleSheet.create({
	card: {
		marginBottom: 16,
	},
	runButton: {
		marginTop: 8,
	},
})
