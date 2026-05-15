import { useState, useEffect } from "react"
import { StyleSheet, ScrollView, Linking } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { List, Divider, RadioButton } from "react-native-paper"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { RootStackParamList } from "../../types"
import { useExtendedTheme } from "../../../theme"
import AsyncStorage from "@react-native-async-storage/async-storage"
import DeviceInfo from "react-native-device-info"

type SettingsNavigationProp = NativeStackNavigationProp<
	RootStackParamList,
	"Settings"
>

const DevIcon = (props: any) => <List.Icon {...props} icon="developer-board" />
const ChevronIcon = (props: any) => <List.Icon {...props} icon="chevron-right" />
const SyncIcon = (props: any) => <List.Icon {...props} icon="sync" />
const WifiIcon = (props: any) => <List.Icon {...props} icon="wifi" />
const QuestionIcon = (props: any) => <List.Icon {...props} icon="help-circle-outline" />
const InfoIcon = (props: any) => <List.Icon {...props} icon="information-outline" />
const SecurityIcon = (props: any) => <List.Icon {...props} icon="shield-check-outline" />
const TutorialIcon = (props: any) => <List.Icon {...props} icon="school" />
const DeleteIcon = (props: any) => <List.Icon {...props} icon="delete-outline" color="#B3261E" />

export const Settings = () => {
	const navigation = useNavigation<SettingsNavigationProp>()
	const { spacing, colors } = useExtendedTheme()
	
	const [syncMode, setSyncMode] = useState('auto')

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const savedMode = await AsyncStorage.getItem('@settings_sync_mode')
				if (savedMode) setSyncMode(savedMode)
			} catch (e) {
				// ignore
			}
		}
		loadSettings()
	}, [])

	const handleSyncModeChange = async (value: string) => {
		setSyncMode(value)
		try {
			await AsyncStorage.setItem('@settings_sync_mode', value)
		} catch (e) {
			// ignore
		}
	}

	const openPrivacyPolicy = () => {
		Linking.openURL('https://wildlife.ai/privacy') 
	}

	const openAccountDeletion = () => {
		Linking.openURL('https://forms.gle/aasjsW5N26giYDk96')
	}

	return (
		<WWScreenView>
			<ScrollView contentContainerStyle={styles.container}>
				
				<List.Section>
					<List.Subheader>Data Synchronization</List.Subheader>
					<RadioButton.Group onValueChange={handleSyncModeChange} value={syncMode}>
						<List.Item
							title="Automatic sync"
							description="Automatically sync data in the background"
							left={SyncIcon}
							right={() => <RadioButton value="auto" />}
							onPress={() => handleSyncModeChange("auto")}
						/>
						
						<List.Item
							title="Sync on Wi-Fi only"
							description="Prevent using mobile data for uploads"
							left={WifiIcon}
							right={() => <RadioButton value="wifi" />}
							onPress={() => handleSyncModeChange("wifi")}
						/>
						
						<List.Item
							title="Ask before syncing"
							description="Show confirmation before large uploads"
							left={QuestionIcon}
							right={() => <RadioButton value="ask" />}
							onPress={() => handleSyncModeChange("ask")}
						/>
					</RadioButton.Group>
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
						description={`v${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`}
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
