import React from "react"
import { View, StyleSheet } from "react-native"
import { useNetInfo } from "@react-native-community/netinfo"
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context"
import { WWText } from "./WWText"
import { useTheme, Text } from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialCommunityIcons"

/**
 * OfflineIndicator - Shows network connectivity status
 * Displays a banner when offline, hidden when online
 *
 * Rendered once, by `OfflineAwareRoot`, never by a screen. Screens used to
 * place it by hand and the stack header drew a small "Offline" chip of its
 * own, so the operator saw one form on one screen and the other on the next.
 */
export const OfflineIndicator: React.FC = () => {
	const netInfo = useNetInfo()
	const theme = useTheme()
	const { top } = useSafeAreaInsets()

	const isOffline = netInfo.isConnected === false

	if (!isOffline) {
		return null
	}

	return (
		// The status bar's own strip first, then the banner directly under it
		<View style={[styles.statusBarStrip, { paddingTop: top }]} testID="offline-indicator">
			<View style={[styles.container, { backgroundColor: theme.colors.error }]}>
				<Icon name="wifi-off" size={16} color="#fff" style={styles.icon} />
				<WWText style={styles.text}><Text>Offline Mode</Text></WWText>
			</View>
		</View>
	)
}

/**
 * The app under the offline banner. The banner takes the top of the screen,
 * under the status bar, and the navigation starts below it.
 *
 * The nested SafeAreaProvider is what keeps every screen right. It measures
 * insets for its own frame, so below the banner the top inset is 0 and a
 * header, a SafeAreaView or `useSafeAreaInsets().top` no longer leaves room
 * for a status bar the banner already sits under. Online there is no banner,
 * the frame starts at the top, and the inset is the status bar's as before.
 */
export const OfflineAwareRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<View style={styles.root}>
		<OfflineIndicator />
		<SafeAreaProvider style={styles.root}>{children}</SafeAreaProvider>
	</View>
)

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	// Matches the StatusBar's own background in App.tsx, so its light icons stay readable
	statusBarStrip: {
		backgroundColor: "#000000",
	},
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
