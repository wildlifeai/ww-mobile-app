import { Platform } from "react-native"
import ExpoNordicDfu from "@getquip/expo-nordic-dfu"

export class DfuService {
	static async startDFU(
		deviceAddress: string,
		firmwareFilePath: string,
		onProgress?: (progress: number) => void,
	) {
		let subscription: { remove: () => void } | undefined

		try {
			// Set up progress listener
			subscription = ExpoNordicDfu.module.addListener("DFUProgress", (update) => {
				onProgress?.(update?.percent || 0)
			})

			// Ensure file path is correct
			// The new library expects 'fileUri', so we should typically pass the URI directly.
			const fileUri = firmwareFilePath

			const result = await ExpoNordicDfu.startDfu({
				deviceAddress,
				fileUri,
			})

			return result
		} catch (error) {
			logError("DFU failed:", error)
			throw error
		} finally {
			// Clean up listener
			subscription?.remove()
		}
	}
}
