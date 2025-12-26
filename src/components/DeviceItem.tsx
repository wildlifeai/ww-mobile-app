import React from "react"
import { StyleSheet, View } from "react-native"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { ActivityIndicator, Text, TouchableRipple } from "react-native-paper"
import { WWButton, WWIconButton } from "./ui/WWButton"

/**
 * Convert RSSI value to human-readable connection quality
 * @param rssi Signal strength in dBm (typically -30 to -100)
 * @param isConnected Whether the device is currently connected
 * @returns Connection quality label
 */
const getConnectionQuality = (rssi: number, isConnected: boolean = false): string => {
	// Connected devices always show as connected (RSSI not updated while connected)
	if (isConnected) return "Connected"

	// Invalid or stale RSSI values (valid RSSI should be negative)
	if (rssi === 127 || rssi === 0 || rssi > 0) return "Scan to update"

	// Valid RSSI ranges (negative values)
	if (rssi >= -50) return "Excellent"
	if (rssi >= -70) return "Good"
	if (rssi >= -85) return "Fair"
	return "Poor"
}

type DeviceItemProps = {
	item: ExtendedPeripheral
	disconnect: (item: ExtendedPeripheral) => Promise<void>
	go: (item: ExtendedPeripheral) => Promise<void>
	upgrade: (item: ExtendedPeripheral) => void
	disabled?: boolean
}

export const DeviceItem = ({
	item,
	disconnect,
	go,
	upgrade,
	disabled,
}: DeviceItemProps) => {
	// const showUpgradeButton = item.name?.toLowerCase().includes("dfu")
	const showUpgradeButton = false

	return (
		<TouchableRipple
			disabled={disabled || item.loading || showUpgradeButton}
			onPress={() => go(item)}
		>
			<View style={styles.container}>
				<View style={styles.info}>
					<Text variant="titleMedium">{item.device.name}</Text>
					<Text variant="bodySmall">
						Signal: {getConnectionQuality(item.rssi, item.connected)}
					</Text>
				</View>
				<View style={styles.actions}>
					{item.loading ? (
						<ActivityIndicator />
					) : (
						<>
							{showUpgradeButton && (
								<WWButton
									mode="outlined"
									onPress={() => upgrade(item)}
									disabled={disabled}
								>
									Upgrade
								</WWButton>
							)}
							{item.connected && (
								<WWIconButton
									icon="exit-to-app"
									onPress={() => disconnect(item)}
									disabled={disabled}
								/>
							)}
						</>
					)}
				</View>
			</View>
		</TouchableRipple>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		padding: 16,
		alignItems: "center",
		justifyContent: "space-between",
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	info: {
		flex: 1,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
})
