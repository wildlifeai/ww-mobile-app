import React from "react"
import { View, StyleSheet } from "react-native"
import { useNetInfo } from "@react-native-community/netinfo"
import { WWText } from "./WWText"
import { useTheme, Text } from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"

/**
 * OfflineIndicator - Shows network connectivity status
 * Displays a banner when offline, hidden when online
 */
export const OfflineIndicator: React.FC = () => {
	const netInfo = useNetInfo()
	const theme = useTheme()

	const isOffline = netInfo.isConnected === false

	if (!isOffline) {
		return null
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.colors.error }]}>
			<Icon name="wifi-off" size={16} color="#fff" style={styles.icon} />
			<WWText style={styles.text}><Text>Offline Mode</Text></WWText>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	icon: {
		marginRight: 6,
	},
	text: {
		color: "#fff",
		fontSize: 12,
		fontWeight: "600",
	},
})
