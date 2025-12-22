import { Platform } from "react-native"
import ExpoNordicDfu from "@getquip/expo-nordic-dfu"

export class DfuService {
	static async startDFU(
		deviceAddress: string,
		firmwareFilePath: string,
		onProgress?: (progress: number) => void,
	) {
		try {
			// Set up progress listener
			const subscription = ExpoNordicDfu.module.addListener("DFUProgress", (update) => {
				onProgress?.(update.percent || 0)
			})

			// Ensure file path is correct
			// The new library expects 'fileUri', so we should typically pass the URI directly.
			// If the incoming path is a raw path, we can leave it as is, but if it has file://, we keep it.
			// Assuming firmwareFilePath is a valid URI or path.
			const fileUri = firmwareFilePath

			const result = await ExpoNordicDfu.startDfu({
				deviceAddress,
				fileUri,
				// alternativeAdvertisingNameEnabled is not directly supported in the new interface params shown
				// ignoring it for now as it's optional/deprecated
			})

			// Clean up listener
			subscription.remove()

			return result
		} catch (error) {
			console.error("DFU failed:", error)
			// Clean up listener on error too
			// We can't access subscription here if it was defined inside try block, 
			// but we can remove all listeners provided we know the event name.
			// Or better, define subscription outside.
			ExpoNordicDfu.module.removeAllListeners("DFUProgress")
			throw error
		}
	}
}
