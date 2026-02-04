import { useState, useEffect, useCallback, useMemo } from "react"
import {
	ScrollView,
	StyleSheet,
	View,
	NativeModules,
	Alert,
} from "react-native"
import { Surface, List, Divider, Chip, Button } from "react-native-paper"
import { WWText } from "../../components/ui/WWText"
import { useExtendedTheme } from "../../theme"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
	getReadableVersion,
	getBuildNumber,
	getBundleId,
	getVersion,
} from "react-native-device-info"
import Constants from "expo-constants"
import { Platform } from "react-native"
import {
	resetDatabaseForDev,
	clearDatabaseDataForDev,
	getDatabaseStatus,
} from "../../utils/devDatabaseReset"
import { log } from '../../utils/logger'


export const DevBuildInfo = () => {
	const { appPadding, spacing } = useExtendedTheme()
	const { top } = useSafeAreaInsets()
	const [isResetting, setIsResetting] = useState(false)
	const [dbStatus, setDbStatus] = useState<{
		isDevelopment: boolean
		supabaseUrl: string
		adapter: string
	} | null>(null)

	const isDevelopment = __DEV__

	// Load database status on mount
	useEffect(() => {
		const loadDbStatus = async () => {
			try {
				const status = await getDatabaseStatus()
				setDbStatus(status)
			} catch (error) {
				logError("Failed to load database status:", error)
			}
		}
		loadDbStatus()
	}, [])
	const expoSdkVersion = Constants.expoConfig?.sdkVersion || "Unknown"
	const bundleId = getBundleId()
	const appVersion = getVersion()
	const buildNumber = getBuildNumber()
	const readableVersion = getReadableVersion()

	// Get React Native version
	const reactNativeVersion = Platform.constants?.reactNativeVersion || {}
	const rnVersionString = `${reactNativeVersion.major || 0}.${reactNativeVersion.minor || 0
		}.${reactNativeVersion.patch || 0}`

	// Count native modules
	const nativeModuleKeys = Object.keys(NativeModules)
	const nativeModuleCount = nativeModuleKeys.length

	// Debug: Log available native modules in development
	if (__DEV__) {
		log("Available Native Modules:", nativeModuleKeys.sort())
	}

	// Check if module is detected via NativeModules or exists in package.json
	const checkModule = (nativeCheck: boolean, packageName: string) => {
		if (nativeCheck) return { status: "loaded", source: "native" }

		// Check package.json as fallback
		const packageJson = require("../../../package.json")
		if (packageJson.dependencies?.[packageName]) {
			return {
				status: "package",
				source: "package.json",
				version: packageJson.dependencies[packageName],
			}
		}
		return { status: "missing", source: "none" }
	}

	// Handle database reset
	const handleDatabaseReset = useCallback(() => {
		Alert.alert(
			"Reset Database",
			"This will delete ALL local data and recreate the database schema. You'll need to re-authenticate.\n\nAre you sure?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					style: "destructive",
					onPress: async () => {
						setIsResetting(true)
						try {
							await resetDatabaseForDev()
							Alert.alert(
								"Success",
								"Database reset complete. Please restart the app.",
							)
							// Refresh database status
							const status = await getDatabaseStatus()
							setDbStatus(status)
						} catch (error) {
							Alert.alert(
								"Error",
								`Failed to reset database: ${error instanceof Error ? error.message : "Unknown error"
								}`,
							)
						} finally {
							setIsResetting(false)
						}
					},
				},
			],
		)
	}, [])

	// Handle database clear
	const handleDatabaseClear = useCallback(() => {
		Alert.alert(
			"Clear Database Data",
			"This will delete ALL local data but keep the database schema. You'll need to re-authenticate.\n\nAre you sure?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear",
					style: "destructive",
					onPress: async () => {
						setIsResetting(true)
						try {
							await clearDatabaseDataForDev()
							Alert.alert(
								"Success",
								"Database cleared. Please restart the app.",
							)
						} catch (error) {
							Alert.alert(
								"Error",
								`Failed to clear database: ${error instanceof Error ? error.message : "Unknown error"
								}`,
							)
						} finally {
							setIsResetting(false)
						}
					},
				},
			],
		)
	}, [])

	// Key native modules we care about - checking multiple possible names
	const keyModules = useMemo(() => ({
		"BLE Manager": checkModule(
			!!NativeModules.BleManager,
			"react-native-ble-manager",
		),
		"Nordic DFU": checkModule(
			!!NativeModules.NordicDfu || !!NativeModules.RNNordicDfu,
			"react-native-nordic-dfu",
		),
		Maps: checkModule(
			!!NativeModules.RNCMaps ||
			!!NativeModules.AirGoogleMaps ||
			!!NativeModules.RNMaps,
			"react-native-maps",
		),
		"File System": checkModule(
			!!NativeModules.ExponentFileSystem || !!NativeModules.FileSystem,
			"expo-file-system",
		),
		Constants: checkModule(
			!!NativeModules.ExponentConstants ||
			!!NativeModules.ExpoConstants ||
			!!Constants,
			"expo-constants",
		),
		"Bluetooth State": checkModule(
			!!NativeModules.RNBluetoothStateManager,
			"react-native-bluetooth-state-manager",
		),
	}), [])

	const dynamicStyles = useMemo(() => ({
		surface: { padding: appPadding, paddingTop: appPadding + top },
		header: { marginBottom: spacing * 2 },
		chip: { marginTop: spacing },
		divider: { marginVertical: spacing },
		nativeModuleChip: {
			backgroundColor: nativeModuleCount === 0 ? "#ffeb3b" : "#4caf50",
		},
		nativeModuleChipText: {
			color: nativeModuleCount === 0 ? "#000" : "#fff",
		},
		moduleList: { paddingHorizontal: spacing * 2, marginBottom: spacing },
		moduleRow: {
			flexDirection: "row" as const,
			justifyContent: "space-between" as const,
			paddingVertical: spacing / 2,
		},
		moduleStatus: (color: string) => ({ color, fontSize: 12, flex: 1, textAlign: "right" as const }),
		dbActionContainer: { paddingHorizontal: spacing * 2, gap: spacing },
		devNotice: { textAlign: "center" as const, opacity: 0.7, paddingTop: spacing },
		footer: { marginTop: spacing * 3 },
	}), [appPadding, top, spacing, nativeModuleCount])

	const renderIcon = useCallback((iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />, [])
	const renderTotalNativeModulesRight = useCallback(() => (
		<Chip
			mode="flat"
			compact
			style={dynamicStyles.nativeModuleChip}
			textStyle={dynamicStyles.nativeModuleChipText}
		>
			{nativeModuleCount === 0 ? "Debug" : "OK"}
		</Chip>
	), [dynamicStyles, nativeModuleCount])

	return (
		<ScrollView style={styles.container}>
			<Surface
				style={[
					styles.surface,
					dynamicStyles.surface,
				]}
			>
				<View style={[styles.header, dynamicStyles.header]}>
					<WWText variant="titleLarge">Development Build Info</WWText>
					<Chip icon="developer-board" style={dynamicStyles.chip}>
						Expo Dev Client
					</Chip>
				</View>

				<List.Section>
					<List.Subheader>Build Information</List.Subheader>
					<List.Item
						title="Build Type"
						description={isDevelopment ? "Development" : "Production"}
						left={renderIcon("wrench")}
					/>
					<List.Item
						title="Bundle Identifier"
						description={bundleId}
						left={renderIcon("package-variant")}
					/>
					<List.Item
						title="App Version"
						description={`${appVersion} (${buildNumber})`}
						left={renderIcon("tag")}
					/>
					<List.Item
						title="Readable Version"
						description={readableVersion}
						left={renderIcon("information")}
					/>
				</List.Section>

				<Divider style={dynamicStyles.divider} />

				<List.Section>
					<List.Subheader>Expo Information</List.Subheader>
					<List.Item
						title="Expo SDK Version"
						description={expoSdkVersion}
						left={renderIcon("rocket")}
					/>
					<List.Item
						title="Expo Client"
						description="Development Client"
						left={renderIcon("cellphone")}
					/>
					<List.Item
						title="Metro Bundler"
						description="Connected via WSL2"
						left={renderIcon("wifi")}
					/>
				</List.Section>

				<Divider style={dynamicStyles.divider} />

				<List.Section>
					<List.Subheader>Platform Information</List.Subheader>
					<List.Item
						title="Platform"
						description={Platform.OS}
						left={renderIcon("cellphone")}
					/>
					<List.Item
						title="Platform Version"
						description={`API ${Platform.Version}`}
						left={renderIcon("information-outline")}
					/>
					<List.Item
						title="React Native Version"
						description={rnVersionString}
						left={renderIcon("react")}
					/>
				</List.Section>

				<Divider style={dynamicStyles.divider} />

				<List.Section>
					<List.Subheader>Native Modules</List.Subheader>
					<List.Item
						title="Total Native Modules"
						description={`${nativeModuleCount} modules loaded`}
						left={renderIcon("puzzle")}
						right={renderTotalNativeModulesRight}
					/>
				</List.Section>

				<View style={dynamicStyles.moduleList}>
					{Object.entries(keyModules).map(([module, moduleInfo]) => {
						const getStatusDisplay = (info: any) => {
							switch (info.status) {
								case "loaded":
									return { text: "✓ Loaded", color: "green" }
								case "package":
									return {
										text: `⚠ In package.json (${info.version})`,
										color: "#ff9800",
									}
								case "missing":
									return { text: "✗ Not Found", color: "red" }
								default:
									return { text: "? Unknown", color: "gray" }
							}
						}

						const { text, color } = getStatusDisplay(moduleInfo)

						return (
							<View
								key={module}
								style={dynamicStyles.moduleRow}
							>
								<WWText variant="bodyMedium">{module}</WWText>
								<WWText
									variant="bodyMedium"
									style={dynamicStyles.moduleStatus(color)}
								>
									{text}
								</WWText>
							</View>
						)
					})}
				</View>

				<Divider style={dynamicStyles.divider} />

				<List.Section>
					<List.Subheader>Database (Dev Tools)</List.Subheader>
					<List.Item
						title="Database Adapter"
						description={dbStatus ? dbStatus.adapter : "Loading..."}
						left={renderIcon("database")}
					/>
					<List.Item
						title="Supabase Instance"
						description={
							dbStatus?.supabaseUrl
								? dbStatus.supabaseUrl.includes("localhost")
									? "Local"
									: dbStatus.supabaseUrl.includes("supabase.co")
										? "Cloud Dev"
										: "Unknown"
								: "Loading..."
						}
						left={renderIcon("cloud")}
					/>
				</List.Section>

				<View style={dynamicStyles.dbActionContainer}>
					<Button
						mode="outlined"
						onPress={handleDatabaseClear}
						disabled={isResetting}
						icon="delete-sweep"
						buttonColor="transparent"
						textColor="#ff9800"
					>
						Clear Database Data
					</Button>
					<Button
						mode="outlined"
						onPress={handleDatabaseReset}
						disabled={isResetting}
						icon="database-refresh"
						buttonColor="transparent"
						textColor="#f44336"
					>
						Reset Database (Full)
					</Button>
					<WWText
						variant="bodySmall"
						style={dynamicStyles.devNotice}
					>
						⚠️ Dev Only: These actions will delete all local data
					</WWText>
				</View>

				<Divider style={dynamicStyles.divider} />

				<List.Section>
					<List.Subheader>Migration Status</List.Subheader>
					<List.Item
						title="Migration"
						description="Expo SDK 51 Migration Complete"
						left={renderIcon("check-circle")}
					/>
					<List.Item
						title="EAS Build"
						description="Development Client Active"
						left={renderIcon("cloud-check")}
					/>
					<List.Item
						title="Native Modules"
						description="BLE, Maps, Nordic DFU Working"
						left={renderIcon("check-all")}
					/>
				</List.Section>

				<View style={[styles.footer, dynamicStyles.footer]}>
					<WWText
						variant="bodySmall"
						style={dynamicStyles.devNotice}
					>
						This screen is only visible in development builds
					</WWText>
				</View>
			</Surface>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	surface: {
		flex: 1,
	},
	header: {
		alignItems: "center",
	},
	footer: {
		padding: 20,
		alignItems: "center",
	},
})
