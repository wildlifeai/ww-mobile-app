import React from "react"
import { StyleSheet, View } from "react-native"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { ActivityIndicator, Text, TouchableRipple } from "react-native-paper"
import { WWButton, WWIconButton } from "./ui/WWButton"

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
						RSSI: {item.rssi === 127 ? "N/A" : item.rssi}
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
