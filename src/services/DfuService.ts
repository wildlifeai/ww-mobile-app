import { Platform } from "react-native"
import { NordicDFU, DFUEmitter } from "@circularing/react-native-nordic-dfu"

export class DfuService {
	static async startDFU(
		deviceAddress: string,
		firmwareFilePath: string,
		onProgress?: (progress: number) => void,
	) {
		try {
			// Set up progress listener
			DFUEmitter.addListener("DFUProgress", (update) => {
				onProgress?.(update.percent || 0)
			})

			// Ensure file path is correct for the native module
			// Android often requires the raw path without 'file://' prefix for native file access not going through ContentResolver
			const filePath = Platform.OS === 'android' && firmwareFilePath.startsWith('file://')
				? firmwareFilePath.replace('file://', '')
				: firmwareFilePath

			const result = await NordicDFU.startDFU({
				deviceAddress,
				filePath,
				alternativeAdvertisingNameEnabled: false,
			})

			// Clean up listener
			DFUEmitter.removeAllListeners("DFUProgress")

			return result
		} catch (error) {
			console.error("DFU failed:", error)
			// Clean up listener on error too
			DFUEmitter.removeAllListeners("DFUProgress")
			throw error
		}
	}
}
