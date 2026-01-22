import { NativeStackHeaderProps } from "@react-navigation/native-stack"
import { Appbar, Chip } from "react-native-paper"
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

	return (
		<Appbar.Header mode="center-aligned">
			{back ? (
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
				{title && <Appbar.Content title={title} />}
				{isOffline && (
					<Chip
						style={styles.offlineChip}
						textStyle={styles.offlineChipText}
						compact
						mode="outlined"
						icon="wifi-off"
					>
						Offline
					</Chip>
				)}
			</View>
		</Appbar.Header>
	)
}

const styles = StyleSheet.create({
	contentContainer: {
		flex: 1,
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
