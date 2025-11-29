import { useRoute, useIsFocused } from "@react-navigation/native"
import { useState } from "react"
import { useCallback } from "react"
import { useEffect, useRef } from "react"

import {
	Keyboard,
	NativeScrollEvent,
	NativeSyntheticEvent,
	StyleSheet,
	View,
} from "react-native"
import { AppParams } from ".."
import { CustomKeyboardAvoidingView } from "../../components/CustomKeyboardAvoidingView"
import { useBleActions } from "../../providers/BleEngineProvider"
import { useAppSelector } from "../../redux"
import { useCommand } from "../../hooks/useCommand"
import { COMMANDS } from "../../ble/types"
import { useSelectDevice } from "../../hooks/useSelectDevice"
import {
	Button,
	Divider,
	IconButton,
	RadioButton,
	Switch,
	TextInput,
} from "react-native-paper"
import { WWText } from "../../components/ui/WWText"
import { useExtendedTheme } from "../../theme"
import { WWTextInput } from "../../components/ui/WWTextInput"
import { WWScreenView } from "../../components/ui/WWScreenView"
import { WWScrollView } from "../../components/ui/WWScrollView"
import { AppLoading } from "./AppLoading"

type Props = {
	embed?: boolean
}

export const Terminal = ({ embed }: Props) => {
	const scrollViewRef = useRef<any>()
	const {
		params: { deviceId },
	} = useRoute<AppParams<"Terminal">>()
	const deviceLogs = useAppSelector((state) => state.logs)
	const [text, setText] = useState("")
	const isFocused = useIsFocused()
	const { write, pingsPause, disconnectDevice } = useBleActions()
	const device = useSelectDevice({ deviceId })
	const logs = deviceLogs[deviceId]
	const configuration = useAppSelector((state) => state.configuration)
	const config = configuration[deviceId]
	const { spacing, colors, appPadding } = useExtendedTheme()

	const offset = useRef(0)

	const { get: getBattery, commandLoading: batteryLoading } = useCommand({
		deviceId,
		command: COMMANDS.BATTERY,
	})
	const { get: getVersion, commandLoading: versionLoading } = useCommand({
		deviceId,
		command: COMMANDS.VERSION,
	})
	const { get: getDevice, commandLoading: deviceLoading } = useCommand({
		deviceId,
		command: COMMANDS.DEVICE,
	})
	const { get: getId, commandLoading: idLoading } = useCommand({
		deviceId,
		command: COMMANDS.ID,
	})
	const { set: setHb, commandLoading: hbLoading } = useCommand({
		deviceId,
		command: COMMANDS.HEARTBEAT,
	})
	const { set: setAE, commandLoading: aeLoading } = useCommand({
		deviceId,
		command: COMMANDS.APPEUI,
	})
	const { set: setDE, commandLoading: deLoading } = useCommand({
		deviceId,
		command: COMMANDS.DEVEUI,
	})
	const { set: setSensor, commandLoading: sensorLoading } = useCommand({
		deviceId,
		command: COMMANDS.SENSOR,
	})
	const { set: reset } = useCommand({ deviceId, command: COMMANDS.RESET })
	const { set: ping } = useCommand({ deviceId, command: COMMANDS.PING })
	const { set: erase } = useCommand({ deviceId, command: COMMANDS.ERASE })
	const { set: triggerDfu } = useCommand({
		deviceId,
		command: COMMANDS.DFU,
	})

	const [autoscroll, setAutoscroll] = useState(true)
	const [configLoadTimeout, setConfigLoadTimeout] = useState(false)

	const [heartbeat, setHeartbeat] = useState<string>()
	const [heartbeatTime, setHeartbeatTime] = useState<string>("s")
	const [appEui, setAppEui] = useState<string>("")
	const [devEui, setDevEui] = useState<string>("")
	const [localSensor, setLocalSensor] = useState<boolean>()

	// Timeout to force showing screen after 15 seconds even if config not fully loaded
	useEffect(() => {
		const timer = setTimeout(() => {
			setConfigLoadTimeout(true)
			console.log("⏱️ Configuration load timeout reached (15s), forcing screen to show")
		}, 15000) // 15 seconds

		return () => clearTimeout(timer)
	}, [])

	useEffect(() => {
		setLocalSensor(config.SENSOR?.value === "enable")
	}, [config.SENSOR?.value])

	const triggerSensor = (value: boolean) => {
		if (!sensorLoading) {
			setSensor(value ? "enable" : "disable")
			setLocalSensor(value)
		}
	}

	const triggerHeartbeat = () => {
		if (heartbeat && !hbLoading) {
			setHb(`${heartbeat}${heartbeatTime}`)
		}
	}

	const triggerAppEui = () => {
		if (appEui && appEui.length > 0 && !aeLoading) {
			setAE(appEui)
		}
	}

	const triggerDevEui = () => {
		if (devEui && devEui.length > 0 && !deLoading) {
			setDE(devEui)
		}
	}

	const writeText = useCallback(async () => {
		await write(device, [text])
		setText("")
	}, [device, text, write])

	useEffect(() => {
		if (!autoscroll) return

		scrollViewRef.current &&
			scrollViewRef.current.scrollToEnd({ animated: true })
		offset.current = 0
	}, [autoscroll, deviceLogs])

	const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

	useEffect(() => {
		if (isFocused) {
			/**
			 * Small hack since ref sometimes isn't available
			 * right away.
			 */
			setTimeout(() => {
				toggleAutoscroll(true)
				scrollViewRef.current &&
					scrollViewRef.current.scrollToEnd({ animated: true })
			}, 50)
		}

		return () => {
			if (!embed && !isFocused) return
			pingsPause(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isFocused, isKeyboardVisible])

	useEffect(() => {
		if (!embed && isFocused) {
			pingsPause(true)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isFocused])

	const toggleAutoscroll = useCallback((value: boolean) => {
		setAutoscroll(value)
	}, [])

	const onScroll = ({
		nativeEvent,
	}: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
		const currentOffset = nativeEvent.contentOffset.y
		const goingUp = currentOffset < offset.current
		const isOnBottom =
			layoutMeasurement.height + contentOffset.y >= contentSize.height - 50
		offset.current = currentOffset

		if (goingUp) {
			toggleAutoscroll(false)
		}

		if (isOnBottom) {
			toggleAutoscroll(true)
		}
	}

	useEffect(() => {
		const showListener = Keyboard.addListener("keyboardDidShow", () => {
			setIsKeyboardVisible(true)
		})
		const hideListener = Keyboard.addListener("keyboardDidHide", () => {
			setIsKeyboardVisible(false)
		})

		return () => {
			showListener.remove()
			hideListener.remove()
		}
	}, [])

	const {
		HEARTBEAT,
		APPEUI,
		SENSOR,
		LORAWAN,
		DEVEUI,
		BATTERY,
		VERSION,
		ID,
		DEVICE,
	} = config

	// Debug: Log configuration loading status
	console.log("🔍 Terminal Screen Config Status:", {
		deviceId,
		HEARTBEAT: HEARTBEAT?.loaded,
		APPEUI: APPEUI?.loaded,
		SENSOR: SENSOR?.loaded,
		LORAWAN: LORAWAN?.loaded,
		DEVEUI: DEVEUI?.loaded,
		BATTERY: BATTERY?.loaded,
		VERSION: VERSION?.loaded,
		ID: ID?.loaded,
		DEVICE: DEVICE?.loaded,
		configKeys: Object.keys(config),
		fullConfig: config,
	})

	// Show loading screen only if configs are still loading AND timeout hasn't been reached
	const isConfigLoading = (
		!HEARTBEAT?.loaded ||
		!APPEUI?.loaded ||
		!SENSOR?.loaded ||
		!LORAWAN?.loaded ||
		!DEVEUI?.loaded ||
		!BATTERY?.loaded ||
		!VERSION?.loaded ||
		!DEVICE?.loaded ||
		!ID?.loaded
	)

	if (isConfigLoading && !configLoadTimeout) {
		console.log(
			"🔍 Terminal Screen: Still loading configuration, showing AppLoading...",
		)
		return <AppLoading />
	}

	// If timeout reached but still loading, log warning
	if (isConfigLoading && configLoadTimeout) {
		console.warn(
			"⚠️ Terminal Screen: Timeout reached, showing UI with partial configuration. Some values may be missing.",
		)
	}

	return (
		<CustomKeyboardAvoidingView style={styles.scroll}>
			<WWScreenView>
				<View style={(styles.container, { margin: spacing })}>
					{!isKeyboardVisible && (
						<View style={styles.view}>
							<WWScrollView
								ref={scrollViewRef}
								onScroll={onScroll}
								scrollEventThrottle={50}
							>
								<WWText variant="bodyMedium">
									{logs.replaceAll("\r", "")}
								</WWText>
							</WWScrollView>
							{!autoscroll && (
								<IconButton
									icon="chevron-down"
									mode="contained"
									iconColor={colors.primary}
									style={styles.fab}
									onPress={() => {
										toggleAutoscroll(true)
										scrollViewRef.current &&
											scrollViewRef.current.scrollToEnd({ animated: true })
									}}
								/>
							)}
						</View>
					)}
					<View style={[{ marginVertical: spacing }, styles.input]}>
						<WWTextInput
							autoCorrect={false}
							autoCapitalize="none"
							style={styles.inputText}
							value={text}
							onChange={(value: string) => setText(value)}
							right={
								<TextInput.Icon
									size={30}
									icon="send"
									color={colors.primary}
									onPress={writeText}
								/>
							}
						/>
					</View>
				</View>
				<Divider style={{ marginVertical: appPadding }} bold />

				<View style={styles.scrollContainer}>
					<WWScrollView style={styles.scroll}>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Actions</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={styles.button}>
									<Button mode="outlined" onPress={() => reset()}>
										Reset
									</Button>
								</View>
								<View style={styles.button}>
									<Button mode="outlined" onPress={() => erase()}>
										Erase
									</Button>
								</View>
								<View style={styles.button}>
									<Button mode="outlined" onPress={() => ping()}>
										Ping
									</Button>
								</View>
								<View style={styles.button}>
									<Button
										mode="outlined"
										onPress={() => disconnectDevice(device)}
									>
										Disconnect
									</Button>
								</View>
								<View style={styles.button}>
									<Button mode="outlined" onPress={() => triggerDfu()}>
										DFU mode
									</Button>
								</View>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">ID</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{ID?.loaded && (
										<WWText>
											ID:{" "}
											{idLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{ID?.value}</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<Button mode="outlined" onPress={getId}>
									Refresh ID
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Device</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{DEVICE?.loaded && (
										<WWText>
											Device name:{" "}
											{deviceLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{DEVICE?.value}</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<Button mode="outlined" onPress={getDevice}>
									Refresh device
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Version</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{VERSION?.loaded && (
										<WWText>
											Version:{" "}
											{versionLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{VERSION?.value}</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<Button mode="outlined" onPress={getVersion}>
									Refresh version
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Battery</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{BATTERY?.loaded && (
										<WWText>
											Current battery level:{" "}
											{batteryLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{BATTERY?.value}%</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<Button mode="outlined" onPress={getBattery}>
									Refresh battery level
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Heartbeat</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{HEARTBEAT?.loaded && (
										<WWText>
											Current heartbeat:{" "}
											{hbLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>
													{formatHeartbeat(HEARTBEAT?.value)}
												</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<WWTextInput
									keyboardType="numeric"
									value={heartbeat}
									onChangeText={(value: string) => setHeartbeat(value)}
									style={{ marginRight: spacing }}
									placeholder={HEARTBEAT?.value}
								/>
								<Button mode="outlined" onPress={triggerHeartbeat}>
									Change Heartbeat
								</Button>
							</View>
							<View style={{ marginVertical: spacing }}>
								<WWText variant="bodyLarge">
									You are setting the value in: {formatHeartbeat(heartbeatTime)}
								</WWText>
								<RadioButton.Group
									onValueChange={setHeartbeatTime}
									value={heartbeatTime}
								>
									<View style={styles.radioButton}>
										<RadioButton.Item label="Days" value="d" />
									</View>
									<View style={styles.radioButton}>
										<RadioButton.Item label="Hours" value="h" />
									</View>
									<View style={styles.radioButton}>
										<RadioButton.Item label="Minutes" value="m" />
									</View>
									<View style={styles.radioButton}>
										<RadioButton.Item label="Seconds" value="s" />
									</View>
								</RadioButton.Group>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">App EUI</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{APPEUI?.loaded && (
										<WWText>
											Current App EUI:{" "}
											{aeLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{APPEUI?.value}</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<WWTextInput
									value={heartbeat}
									onChangeText={(value: string) => setAppEui(value)}
									style={{ marginRight: spacing }}
									placeholder={APPEUI?.value}
								/>
								<Button mode="outlined" onPress={triggerAppEui}>
									Save
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Dev EUI</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={{ padding: spacing }}>
									{DEVEUI?.loaded && (
										<WWText>
											Current Dev EUI:{" "}
											{deLoading ? (
												"Loading..."
											) : (
												<WWText style={styles.bold}>{DEVEUI?.value}</WWText>
											)}
										</WWText>
									)}
								</View>
							</View>
							<View style={styles.heartbeat}>
								<WWTextInput
									value={heartbeat}
									onChangeText={(value: string) => setDevEui(value)}
									style={{ marginRight: spacing }}
									placeholder={DEVEUI?.value}
								/>
								<Button mode="outlined" onPress={triggerDevEui}>
									Save
								</Button>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Sensor messages</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<View style={[styles.button, { marginEnd: spacing }]}>
									<Switch
										disabled={sensorLoading}
										value={localSensor}
										onValueChange={triggerSensor}
									/>
								</View>
								<WWText>
									Sensor messages are{" "}
									{SENSOR?.value === "enable" ? (
										<WWText style={styles.bold}>enabled</WWText>
									) : (
										<WWText style={styles.bold}>disabled</WWText>
									)}
									.
								</WWText>
							</View>
						</View>
						<View style={{ paddingVertical: spacing }}>
							<WWText variant="titleMedium">Lorawan status</WWText>
							<Divider />
							<View style={[styles.buttons, { marginVertical: spacing }]}>
								<WWText>
									Lorawan is currently{" "}
									<WWText style={styles.bold}>
										{LORAWAN?.value?.toLowerCase()}
									</WWText>
									.
								</WWText>
							</View>
						</View>
					</WWScrollView>
				</View>
			</WWScreenView>
		</CustomKeyboardAvoidingView>
	)
}

const formatHeartbeat = (s?: string) => {
	if (!s) return ""

	const heartbeat = s.slice(0, -1)
	const time = s.slice(-1)

	if (!["d", "h", "m", "s"].includes(time)) return "Invalid input"

	switch (time) {
		case "d":
			return `${heartbeat} days`.trim()
		case "h":
			return `${heartbeat} hours`.trim()
		case "m":
			return `${heartbeat} minutes`.trim()
		default:
			return `${heartbeat} seconds`.trim()
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	scrollContainer: { flex: 1 },
	scroll: { flex: 1 },
	view: { height: 150 },
	fab: {
		position: "absolute",
		bottom: 20,
		right: 20,
	},
	input: {
		flexDirection: "row",
		alignItems: "center",
	},
	inputText: { flex: 2 },
	buttons: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
	},
	button: {
		margin: 5,
	},
	bold: {
		fontWeight: "400",
	},
	heartbeat: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
	},
	idversion: {
		width: "100%",
	},
	radioButton: {
		flexDirection: "row",
		alignItems: "center",
	},
})
