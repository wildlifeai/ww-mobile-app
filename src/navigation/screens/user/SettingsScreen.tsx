import { View, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { List, Divider, Text } from "react-native-paper"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { RootStackParamList } from "../../types"
import { useExtendedTheme } from "../../../theme"

type SettingsNavigationProp = NativeStackNavigationProp<
	RootStackParamList,
	"Settings"
>

const DevIcon = (props: any) => <List.Icon {...props} icon="developer-board" />
const ChevronIcon = (props: any) => <List.Icon {...props} icon="chevron-right" />

export const Settings = () => {
	const navigation = useNavigation<SettingsNavigationProp>()
	const { spacing } = useExtendedTheme()

	return (
		<WWScreenView>
			<View style={styles.container}>
				<WWText variant="titleSmall"><Text>Settings screen.</Text></WWText>

				{__DEV__ && (
					<>
						<Divider style={{ marginVertical: spacing * 2 }} />
						<List.Section>
							<List.Subheader><Text>Developer Options</Text></List.Subheader>
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
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
