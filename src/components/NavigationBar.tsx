import { NativeStackHeaderProps } from "@react-navigation/native-stack"
import { Appbar, Chip } from "react-native-paper"
import { getHeaderTitle } from "@react-navigation/elements"
import { useAppDrawer } from "./AppDrawer"
import { useExtendedTheme } from "../theme"
import { WWAvatar } from "./ui/WWAvatar"
import { View } from "react-native"

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
				{__DEV__ && route.name === "Home" && (
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
