import {
	Dispatch,
	PropsWithChildren,
	createContext,
	useContext,
	useState,
} from "react"
import { StyleSheet, View } from "react-native"
import { Drawer } from "react-native-drawer-layout"
import { Avatar, Surface } from "react-native-paper"
import { WWText } from "./ui/WWText"
import { useExtendedTheme } from "../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getReadableVersion } from "react-native-device-info"
import { SideNavigation } from "./SideNavigation"
import { useAppSelector } from "../redux"

type DrawerContextProps = {
	isOpen: boolean
	setIsOpen: Dispatch<React.SetStateAction<boolean>>
}
const DrawerContext = createContext({} as DrawerContextProps)

export const useAppDrawer = () => useContext(DrawerContext)

export const AppDrawer = ({ children }: PropsWithChildren<unknown>) => {
	const [isOpen, setIsOpen] = useState(false)
	const { appPadding, spacing } = useExtendedTheme()
	const { token } = useAppSelector((state) => state.authentication)
	const { top } = useSafeAreaInsets()

	return (
		<Drawer
			swipeEnabled={!!token}
			open={isOpen}
			onOpen={() => setIsOpen(true)}
			onClose={() => setIsOpen(false)}
			drawerStyle={styles.view}
			renderDrawerContent={() => {
				return (
					<Surface
						style={[
							{ padding: appPadding, paddingTop: appPadding + top },
							styles.view,
						]}
					>
						<Avatar.Image source={require("../assets/avatar.png")} />
						<SideNavigation drawerControls={setIsOpen} />
						<View style={styles.version}>
							<WWText>Current version:</WWText>
							<WWText style={[styles.versionText, { marginStart: spacing }]}>
								v{getReadableVersion()}
							</WWText>
						</View>
					</Surface>
				)
			}}
		>
			<DrawerContext.Provider value={{ isOpen, setIsOpen }}>
				{children}
			</DrawerContext.Provider>
		</Drawer>
	)
}

const styles = StyleSheet.create({
	view: {
		flex: 1,
		height: "auto",
	},
	test: {
		height: 500,
	},
	version: {
		flex: 1,
		flexDirection: "row",
		alignItems: "flex-end",
	},
	versionText: {
		fontWeight: "bold",
	},
})
