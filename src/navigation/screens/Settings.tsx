import { View, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { List, Divider } from "react-native-paper"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWText } from "../../components/ui/WWText"
import { RootStackParamList } from "../index"
import { useExtendedTheme } from "../../theme"

type SettingsNavigationProp = NativeStackNavigationProp<
	RootStackParamList,
	"Settings"
>

export const Settings = () => {
	const navigation = useNavigation<SettingsNavigationProp>()
	const { spacing } = useExtendedTheme()

	return (
		<WWScreenView>
			<View style={styles.container}>
				<WWText variant="titleSmall">Settings screen.</WWText>

				{__DEV__ && (
					<>
						<Divider style={{ marginVertical: spacing * 2 }} />
						<List.Section>
							<List.Subheader>Developer Options</List.Subheader>
							<List.Item
								title="Developer Settings"
								description="Runtime environment switching and debug tools"
								left={(props) => <List.Icon {...props} icon="developer-board" />}
								right={(props) => <List.Icon {...props} icon="chevron-right" />}
								onPress={() => navigation.navigate("DeveloperSettings")}
								testID="developer-settings-button"
								accessibilityLabel="Open Developer Settings"
								accessibilityRole="button"
							/>
						</List.Section>
					</>
				)}
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
