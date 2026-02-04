import { StyleSheet } from "react-native"
import { WWIcon } from "../../../components/ui/WWIcon"
import { useExtendedTheme } from "../../../theme"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { WWText } from "../../../components/ui/WWText"

export const BluetoothProblems = () => {
	const { spacing } = useExtendedTheme()

	return (
		<WWScreenView style={styles.view}>
			<WWIcon
				containerStyle={[{ marginBottom: spacing }]}
				source="bluetooth"
				size={40}
			/>
			<WWText variant="headlineSmall">Please enable Bluetooth</WWText>
			<WWText variant="bodyMedium">
				This app requires Bluetooth to run. It uses it to connect and setup your
				Wildlife Watcher devices.
			</WWText>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	view: { flex: 1, alignItems: "center", justifyContent: "center" },
})
