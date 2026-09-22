import { NativeStackHeaderProps } from "@react-navigation/native-stack"
import { Appbar, Chip, Text } from "react-native-paper"
import { getHeaderTitle } from "@react-navigation/elements"
import { useAppDrawer } from "./AppDrawer"
import { useExtendedTheme } from "../theme"
import { View, StyleSheet } from "react-native"
import { useNetInfo } from "@react-native-community/netinfo"

export const NavigationBar = ({
	navigation,
	route,
	options,
	back,
}: NativeStackHeaderProps) => {
	const title = getHeaderTitle(options, route.name)
	const { isOpen, setIsOpen } = useAppDrawer()
	const {
		colors: { onBackground },
	} = useExtendedTheme()
	const netInfo = useNetInfo()
	const isOffline = netInfo.isConnected === false

	// A screen that asks for a left-aligned title gets Paper's small bar, which
	// is what a title next to a row of actions needs: centred, it would sit off
	// centre between one icon on the left and several on the right. Every other
	// screen keeps the centred bar it has always had. The Engineer Console is
	// the first to ask (#302).
	const alignLeft = options.headerTitleAlign === "left"

	return (
		<Appbar.Header mode={alignLeft ? "small" : "center-aligned"}>
			{options.headerLeft ? (
				options.headerLeft({ canGoBack: !!back })
			) : back ? (
				<Appbar.BackAction
					iconColor={onBackground}
					onPress={navigation.goBack}
				/>
			) : (
				<Appbar.Action
					iconColor={onBackground}
					icon="menu"
					onPress={() => setIsOpen(!isOpen)}
				/>
			)}
			<View style={styles.contentContainer}>
				{title && <Appbar.Content title={title} style={alignLeft ? undefined : styles.centredTitle} />}
				{isOffline && (
					<Chip
						style={styles.offlineChip}
						textStyle={styles.offlineChipText}
						compact
						mode="outlined"
						icon="wifi-off"
					>
						<Text>Offline</Text>
					</Chip>
				)}
			</View>
			{/* The screen's own actions. This bar replaces the stack's header for
			    every screen, so an option the stack would honour is silently
			    dropped unless it is rendered here; headerRight was, until the
			    console asked for three icons (#302). */}
			{options.headerRight ? options.headerRight({ canGoBack: !!back, tintColor: onBackground }) : null}
		</Appbar.Header>
	)
}

const styles = StyleSheet.create({
	// A row, not a column: Appbar.Content is `flex: 1`, and in a column that
	// grew it to the bar's full height with the title at the top, a line
	// above the actions either side of it. In a row it grows sideways and the
	// title sits on the actions' line. The offline chip is absolutely
	// positioned, so justifyContent is what keeps it centred.
	contentContainer: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	centredTitle: {
		alignItems: "center",
	},
	offlineChip: {
		position: "absolute",
		bottom: -10,
		height: 18,
		minHeight: 18,
		backgroundColor: "rgba(244, 67, 54, 0.9)",
		borderColor: "rgba(244, 67, 54, 1)",
	},
	offlineChipText: {
		fontSize: 9,
		marginVertical: -5,
		color: "#fff",
	},
})
