import { StyleSheet } from "react-native"
import { WWIcon } from "../../../components/ui/WWIcon"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { useExtendedTheme } from "../../../theme"
import { WWText } from "../../../components/ui/WWText"
import { Text } from "react-native-paper"

export const BleProblems = () => {
	const { spacing } = useExtendedTheme()

	return (
		<WWScreenView style={styles.view}>
			<WWIcon
				containerStyle={{ marginBottom: spacing }}
				source="bluetooth"
				size={40}
			/>
			<WWText variant="headlineSmall"><Text>Bluetooth problems</Text></WWText>
			<WWText variant="bodyMedium">
				<Text>For some reason, bluetooth could not start. Please make sure this device
				supports BLE (Bluetooth Low Energy) and that it is enabled.</Text>
			</WWText>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	view: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 30,
	},
})
