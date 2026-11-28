import { useState, useEffect } from "react"
import { StyleSheet, ScrollView, Linking } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { List, Divider, Switch } from "react-native-paper"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { RootStackParamList } from "../../types"
import { useExtendedTheme } from "../../../theme"
import { RefusedChangesItem } from "../../../components/RefusedChangesItem"
import { mobileDataDownloadsAllowed, setMobileDataDownloadsAllowed } from "../../../services/OfflinePrefetchService"
import * as Application from "expo-application"

type SettingsNavigationProp = NativeStackNavigationProp<
	RootStackParamList,
	"Settings"
>

const DevIcon = (props: any) => <List.Icon {...props} icon="developer-board" />
const ChevronIcon = (props: any) => <List.Icon {...props} icon="chevron-right" />
const DownloadIcon = (props: any) => <List.Icon {...props} icon="cellphone-arrow-down" />
const InfoIcon = (props: any) => <List.Icon {...props} icon="information-outline" />
const SecurityIcon = (props: any) => <List.Icon {...props} icon="shield-check-outline" />
const TutorialIcon = (props: any) => <List.Icon {...props} icon="school" />
const DeleteIcon = (props: any) => <List.Icon {...props} icon="delete-outline" color="#B3261E" />

export const Settings = () => {
	const navigation = useNavigation<SettingsNavigationProp>()
	const { spacing, colors } = useExtendedTheme()
	
	// On by default, as OfflinePrefetchService reads it (#573)
	const [mobileDownloads, setMobileDownloads] = useState(true)

	useEffect(() => {
		mobileDataDownloadsAllowed().then(setMobileDownloads)
	}, [])

	const handleMobileDownloadsChange = async (allowed: boolean) => {
		setMobileDownloads(allowed)
		try {
			await setMobileDataDownloadsAllowed(allowed)
		} catch (e) {
			// ignore
		}
	}

	const openPrivacyPolicy = () => {
		Linking.openURL('https://wildlifewatcher.ai/privacy') 
	}

	const openAccountDeletion = () => {
		Linking.openURL('https://forms.gle/aasjsW5N26giYDk96')
	}

	return (
		<WWScreenView>
			<ScrollView contentContainerStyle={styles.container}>
				
				<List.Section>
					<List.Subheader>Data</List.Subheader>
					<RefusedChangesItem />
					<List.Item
						title="Download camera software on mobile data"
						titleNumberOfLines={2}
						description="Firmware and AI models download in the background. Off: only on Wi-Fi."
						descriptionNumberOfLines={3}
						left={DownloadIcon}
						right={() => <Switch value={mobileDownloads} onValueChange={handleMobileDownloadsChange} />}
						onPress={() => handleMobileDownloadsChange(!mobileDownloads)}
						testID="mobile-data-downloads"
					/>
				</List.Section>

				<Divider style={{ marginVertical: spacing }} />

				<List.Section>
					<List.Subheader>About</List.Subheader>
					<List.Item
						title="App Tutorial"
						description="Replay the getting started walkthrough"
						left={TutorialIcon}
						right={ChevronIcon}
						onPress={() => navigation.navigate("Tutorial")}
						testID="tutorial-settings-button"
					/>
					<List.Item
						title="App Version"
						description={`v${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})`}
						left={InfoIcon}
					/>
					<List.Item
						title="Privacy Policy"
						description="View our privacy policy and data handling"
						left={SecurityIcon}
						right={ChevronIcon}
						onPress={openPrivacyPolicy}
					/>
				</List.Section>

				<Divider style={{ marginVertical: spacing }} />

				<List.Section>
					<List.Subheader style={{ color: colors.error }}>Danger Zone</List.Subheader>
					<List.Item
						title="Delete Account"
						description="Request deletion of your account and data"
						titleStyle={{ color: colors.error }}
						left={DeleteIcon}
						right={ChevronIcon}
						onPress={openAccountDeletion}
					/>
				</List.Section>

				{__DEV__ && (
					<>
						<Divider style={{ marginVertical: spacing }} />
						<List.Section>
							<List.Subheader>Developer Options</List.Subheader>
							<List.Item
								title="Developer Settings"
								description="Runtime environment switching and debug tools"
								left={DevIcon}
								right={ChevronIcon}
								onPress={() => navigation.navigate("DeveloperSettings")}
								testID="developer-settings-button"
								accessibilityLabel="Open Developer Settings"
								accessibilityRole="button"
							/>
						</List.Section>
					</>
				)}
			</ScrollView>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		paddingBottom: 20,
	},
})
