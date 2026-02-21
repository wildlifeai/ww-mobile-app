import { useMemo, useCallback } from 'react'
import { View, NativeModules } from 'react-native'
import { List, Chip, Text } from 'react-native-paper'
import { WWText } from '../../../../components/ui/WWText'
import Constants from 'expo-constants'

const ListItemIcon = (iconName: string) => (props: any) => <List.Icon {...props} icon={iconName} />

const Icons = {
    puzzle: ListItemIcon("puzzle"),
}

// Check if module is detected via NativeModules or exists in package.json
const checkModule = (nativeCheck: boolean, packageName: string) => {
    if (nativeCheck) return { status: "loaded", source: "native" }

    // Check package.json as fallback
    const packageJson = require("../../../../../package.json")
    if (packageJson.dependencies?.[packageName]) {
        return {
            status: "package",
            source: "package.json",
            version: packageJson.dependencies[packageName],
        }
    }
    return { status: "missing", source: "none" }
}

export const NativeModulesSection = ({ dynamicStyles }: { dynamicStyles: any }) => {
    const nativeModuleKeys = Object.keys(NativeModules)
    const nativeModuleCount = nativeModuleKeys.length

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

    const TotalNativeModulesRight = useCallback(() => (
        <Chip
            mode="flat"
            compact
            style={dynamicStyles.nativeModuleChip}
            textStyle={dynamicStyles.nativeModuleChipText}
        >
            <Text>{nativeModuleCount === 0 ? "Debug" : "OK"}</Text>
        </Chip>
    ), [dynamicStyles, nativeModuleCount])

    return (
        <>
            <List.Section>
                <List.Subheader><Text>Native Modules</Text></List.Subheader>
                <List.Item
                    title="Total Native Modules"
                    description={`${nativeModuleCount} modules loaded`}
                    left={Icons.puzzle}
                    right={TotalNativeModulesRight}
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
                            <WWText variant="bodyMedium"><Text>{module}</Text></WWText>
                            <WWText
                                variant="bodyMedium"
                                style={dynamicStyles.moduleStatus(color)}
                            >
                                <Text>{text}</Text>
                            </WWText>
                        </View>
                    )
                })}
            </View>
        </>
    )
}
