import { Linking, StyleSheet, View } from "react-native"

import { useAppDispatch, useAppSelector } from "../../../redux"
import { permissionRequest } from "../../../redux/slices/androidPermissionsSlice"
import { WWScreenView } from "../../../components/ui/WWScreenView"
import { Button, Divider } from "react-native-paper"
import { useExtendedTheme } from "../../../theme"
import { WWText } from "../../../components/ui/WWText"

export const NoAndroidPermissions = () => {
	const { error, neverAskAgain } = useAppSelector(
		(state) => state.androidPermissions,
	)
	const dispatch = useAppDispatch()
	const { spacing } = useExtendedTheme()
	const openSettings = () => {
		Linking.openSettings()
	}

	const notAgain = neverAskAgain.length > 0

	return (
		<WWScreenView style={[styles.view]}>
			<View>
				<WWText variant="bodyMedium" align="center" gutter>
					Please grant the necessary permissions to use this app.
				</WWText>
				{error && (
					<WWText style={{ paddingVertical: spacing }} variant="bodyMedium">
						{error.message}
					</WWText>
				)}
			</View>
			<Button
				mode="contained"
				disabled={notAgain}
				onPress={() => dispatch(permissionRequest())}
			>
				Grant permissions
			</Button>
			{notAgain && (
				<>
					<Divider bold style={[{ marginVertical: spacing }, styles.divider]} />
					<WWText variant="bodyMedium" align="center" gutter>
						Could not grant permissions. You will need to do it manually.
						Please, open settings and make sure all services are enabled for the
						Wildlife Watcher application.
					</WWText>
					<Button mode="contained" onPress={openSettings}>
						Open Settings
					</Button>
				</>
			)}
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	view: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	divider: {
		alignSelf: "stretch",
	},
})
