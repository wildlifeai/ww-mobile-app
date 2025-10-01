import { NativeStackHeaderProps } from "@react-navigation/native-stack"
import { Appbar, Chip } from "react-native-paper"
import { getHeaderTitle } from "@react-navigation/elements"
import { useAppDrawer } from "./AppDrawer"
import { useExtendedTheme } from "../theme"
import { WWAvatar } from "./ui/WWAvatar"
import { View } from "react-native"
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
					icon={isOpen ? "backburger" : "forwardburger"}
					onPress={() => setIsOpen(isOpen ? false : true)}
				/>
			)}
			<View style={{ flex: 1, alignItems: 'center' }}>
				{title && <Appbar.Content title={title} />}
				{isOffline && (
					<Chip
						style={{
							position: 'absolute',
							bottom: -10,
							height: 18,
							minHeight: 18,
							backgroundColor: 'rgba(244, 67, 54, 0.9)',
							borderColor: 'rgba(244, 67, 54, 1)',
						}}
						textStyle={{ fontSize: 9, marginVertical: -5, color: '#fff' }}
						compact
						mode="outlined"
						icon="wifi-off"
					>
						Offline
					</Chip>
				)}
				{__DEV__ && !isOffline && route.name === "Home" && (
					<Chip
						style={{
							position: 'absolute',
							bottom: -10,
							height: 18,
							minHeight: 18,
							backgroundColor: 'rgba(255, 255, 255, 0.1)',
							borderColor: 'rgba(255, 255, 255, 0.2)',
						}}
						textStyle={{ fontSize: 9, marginVertical: -5, color: 'rgba(255, 255, 255, 0.6)' }}
						compact
						mode="outlined"
					>
						Expo Dev
					</Chip>
				)}
			</View>
			{!isOpen && <WWAvatar onPress={() => navigation.navigate("Profile")} />}
		</Appbar.Header>
	)
}
