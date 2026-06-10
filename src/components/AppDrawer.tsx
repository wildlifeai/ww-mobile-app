import {
	Dispatch,
	PropsWithChildren,
	createContext,
	useContext,
	useState,
} from "react"
import { StyleSheet, View } from "react-native"
import { Drawer } from "react-native-drawer-layout"
import { Surface, Text } from "react-native-paper"
import { WWText } from "./ui/WWText"
import { useExtendedTheme } from "../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as Application from "expo-application"
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
	const { appPadding } = useExtendedTheme()
	const { user } = useAppSelector((state) => state.authentication)
	const { top } = useSafeAreaInsets()

	return (
		<Drawer
			swipeEnabled={!!user}
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
						<View style={styles.profileSection}>
							<View style={styles.avatar}>
								<WWText style={styles.avatarText}>
									<Text>{user?.profile?.first_name?.[0] || user?.email?.[0] || "U"}</Text>
								</WWText>
							</View>
							<View style={styles.userInfo}>
								<WWText style={styles.userName}>
									<Text>{user?.profile?.first_name
										? `${user.profile.first_name} ${user.profile.last_name || ''}`
										: "Wildlife Watcher User"}</Text>
								</WWText>
								<WWText style={styles.userEmail} variant="bodySmall">
									<Text>{user?.email || "No email"}</Text>
								</WWText>
							</View>
						</View>

						<SideNavigation drawerControls={setIsOpen} />

						<View style={styles.footer}>
							<View style={styles.version}>
								<WWText variant="bodySmall" style={styles.versionLabel}><Text>Version</Text></WWText>
								<WWText variant="bodySmall" style={styles.versionText}>
									<Text>v{Application.nativeApplicationVersion}</Text>
								</WWText>
							</View>
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
		height: "100%",
	},
	profileSection: {
		paddingHorizontal: 24,
		paddingBottom: 24,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0,0,0,0.1)',
		marginBottom: 16,
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: '#2E7D32', // Wildlife Green
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 12,
	},
	avatarText: {
		color: 'white',
		fontSize: 20,
		fontWeight: 'bold',
	},
	userInfo: {
		justifyContent: 'center',
	},
	userName: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	userEmail: {
		color: '#666',
	},
	footer: {
		padding: 24,
		borderTopWidth: 1,
		borderTopColor: 'rgba(0,0,0,0.1)',
	},
	version: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	versionLabel: {
		color: '#888',
	},
	versionText: {
		color: '#888',
		fontWeight: '600',
	},
})
