import React, { useState } from "react"
import { StyleSheet, View, Platform, PermissionsAndroid } from "react-native"
import { Button } from "react-native-paper"
import DocumentPicker from "react-native-document-picker"
import * as FileSystem from "expo-file-system"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWText } from "../../components/ui/WWText"
import { useAppNavigation } from "../../hooks/useAppNavigation"
import { useRoute } from "@react-navigation/native"
import { useSelectDevice } from "../../hooks/useSelectDevice"
import { DfuService } from "../../services/DfuService"
import { AppParams } from ".."
import { useDispatch } from "react-redux"
import { removeDevice } from "../../redux/slices/devicesSlice"
import { WWProgressBar } from "../../components/ui/WWProgressBar"

export const DfuScreen = () => {
	const [fileName, setFileName] = useState<string>()
	const [dfuProgress, setDfuProgress] = useState(0)
	const [dfuError, setDfuError] = useState<string>()
	const navigation = useAppNavigation()
	const {
		params: { deviceId },
	} = useRoute<AppParams<"DfuScreen">>()
	const device = useSelectDevice({ deviceId })
	const dispatch = useDispatch()

	const isUpdating = dfuProgress > 0 && dfuProgress < 100

	const handleFilePick = async () => {
		console.log("🔍 DFU: Starting file pick process...")
		console.log("🔍 DFU: FileSystem.cacheDirectory:", FileSystem.cacheDirectory)
		try {
			// Request necessary permissions first
			if (Platform.OS === "android") {
				try {
					console.log("🔍 DFU: Requesting notification permission...")
					const granted = await PermissionsAndroid.request(
						PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
						{
							title: "Firmware Update Notifications",
							message: "Wildlife Watcher needs notification permission to show firmware update progress",
							buttonNeutral: "Ask Me Later",
							buttonNegative: "Cancel",
							buttonPositive: "Allow",
						},
					)
					console.log("🔍 DFU: Permission result:", granted)
					
					if (granted === PermissionsAndroid.RESULTS.DENIED) {
						console.log("🔍 DFU: Permission denied, continuing without notifications...")
						// Continue anyway - notification permission is not critical for file picking
					} else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
						console.log("🔍 DFU: Permission permanently denied, continuing...")
						// Continue anyway - notification permission is not critical for file picking
					}
				} catch (err) {
					console.log("🔍 DFU: Permission request failed, continuing without notifications:", err)
					// Continue anyway - permission failure shouldn't block file picking
				}
			}

			console.log("🔍 DFU: Launching document picker...")
			const result = await DocumentPicker.pick({
				type: Platform.select({
					ios: ["public.archive"],
					android: [DocumentPicker.types.allFiles],
				}),
			})
			console.log("🔍 DFU: Document picker result:", result[0])

			setFileName(result[0].name || "Unknown file")

			const timestamp = Date.now()
			const localPath = Platform.select({
				ios: result[0].uri,
				android: `${FileSystem.cacheDirectory}firmware_${timestamp}.zip`,
			})

			if (!localPath) {
				throw new Error("Platform not supported for DFU updates")
			}

			if (Platform.OS === "android") {
				console.log("🔍 DFU: Copying file from:", result[0].uri, "to:", localPath)
				await FileSystem.copyAsync({
					from: result[0].uri,
					to: localPath
				})
				console.log("🔍 DFU: File copy completed successfully")
			}

			try {
				await DfuService.startDFU(device.id, localPath, (progress) =>
					setDfuProgress(progress),
				)

				// Remove the specific device after successful DFU
				dispatch(removeDevice({ id: device.id }))
				navigation.goBack()
			} finally {
				// Clean up file regardless of DFU success/failure
				if (Platform.OS === "android") {
					await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(console.error)
				}
			}
		} catch (err) {
			if (!DocumentPicker.isCancel(err)) {
				console.error("🚨 DFU file pick failed:", err)
				console.error("🚨 DFU error details:", {
					message: err instanceof Error ? err.message : "Unknown error",
					stack: err instanceof Error ? err.stack : undefined,
					name: err instanceof Error ? err.name : undefined
				})
				setDfuError(
					err instanceof Error ? err.message : "Unknown error occurred",
				)
			} else {
				console.log("🔍 DFU: User cancelled file picker")
			}
		}
	}

	return (
		<WWScreenView>
			<View style={styles.container}>
				<WWText variant="bodyMedium" style={styles.description}>
					Select a firmware file to update your device. Make sure your device
					stays connected during the update.
				</WWText>

				{fileName && (
					<WWText variant="bodyMedium" style={styles.fileName}>
						Selected file: {fileName}
					</WWText>
				)}

				{dfuError && (
					<WWText variant="bodyMedium" style={styles.error}>
						Error: {dfuError}
					</WWText>
				)}

				{isUpdating ? (
					<WWProgressBar
						progress={dfuProgress / 100}
						showLabel
						label={`Update progress: ${dfuProgress}%`}
					/>
				) : (
					<Button
						mode="contained"
						onPress={handleFilePick}
						style={styles.button}
					>
						Select Firmware File
					</Button>
				)}
			</View>
		</WWScreenView>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
		gap: 16,
	},
	description: {
		marginTop: 8,
	},
	fileName: {
		marginTop: 16,
	},
	error: {
		color: "red",
	},
	button: {
		marginTop: 16,
	},
	progressBar: {
		height: 6,
		borderRadius: 3,
	},
})
