import { StyleSheet } from "react-native"
import { WWIcon } from "../../../components/ui/WWIcon"
import { useExtendedTheme } from "../../../theme"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"
import { Text } from "react-native-paper"

export const BluetoothProblems = () => {
	const { spacing } = useExtendedTheme()

	return (
		<WWScreenView style={styles.view}>
			<WWIcon
				containerStyle={{ marginBottom: spacing }}
				source="bluetooth"
				size={40}
			/>
			<WWText variant="headlineSmall"><Text>Please enable Bluetooth</Text></WWText>
			<WWText variant="bodyMedium">
				<Text>This app requires Bluetooth to run. It uses it to connect and setup your
				Wildlife Watcher devices.</Text>
			</WWText>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	view: { flex: 1, alignItems: "center", justifyContent: "center" },
})
