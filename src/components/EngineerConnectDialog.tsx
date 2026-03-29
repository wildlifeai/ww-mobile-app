import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { Portal, Dialog, Button, ActivityIndicator, Text } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

import { EngineerConnectState } from '../hooks/useEngineerConnect'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'

type Props = {
    visible: boolean
    dialogState: EngineerConnectState
    discoveredDevices: ExtendedPeripheral[]
    connectingDevice: ExtendedPeripheral | null
    onSelectDevice: (device: ExtendedPeripheral) => void
    onDismiss: () => void
}

export const EngineerConnectDialog = ({
    visible,
    dialogState,
    discoveredDevices,
    connectingDevice,
    onSelectDevice,
    onDismiss,
}: Props) => {
    const commonDialogProps = {
        visible: visible && dialogState !== 'idle',
        onDismiss: dialogState === 'scanning' || dialogState === 'connecting' ? undefined : onDismiss,
        dismissable: dialogState !== 'scanning' && dialogState !== 'connecting',
    }

    return (
        <Portal>
            {dialogState === 'scanning' && (
                <Dialog {...commonDialogProps} dismissable={true} onDismiss={onDismiss}>
                    <Dialog.Title><Text>Engineer Console</Text></Dialog.Title>
                    <Dialog.Content>
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color="#4CAF50" style={styles.spinner} />
                            <Text variant="bodyLarge">Scanning for devices...</Text>
                            <Text variant="bodySmall" style={styles.messageText}>
                                Turn on your Wildlife Watcher device to connect
                            </Text>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={onDismiss}><Text>Cancel</Text></Button>
                    </Dialog.Actions>
                </Dialog>
            )}

            {dialogState === 'no_devices' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>No Devices Found</Text></Dialog.Title>
                    <Dialog.Content>
                        <View style={styles.centered}>
                            <MaterialCommunityIcons
                                name="bluetooth-off"
                                size={48}
                                color="#999"
                                style={styles.icon}
                            />
                            <Text variant="bodyLarge" style={styles.messageText}>
                                There is no device nearby advertising BLE
                            </Text>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={onDismiss}><Text>Close</Text></Button>
                    </Dialog.Actions>
                </Dialog>
            )}

            {dialogState === 'connecting' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>Engineer Console</Text></Dialog.Title>
                    <Dialog.Content>
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color="#4CAF50" style={styles.spinner} />
                            <Text variant="bodyLarge">
                                Connecting to {connectingDevice?.name || connectingDevice?.id || 'device'}...
                            </Text>
                        </View>
                    </Dialog.Content>
                </Dialog>
            )}

            {dialogState === 'select' && (
                <Dialog {...commonDialogProps}>
                    <Dialog.Title><Text>Multiple Devices Found</Text></Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={styles.selectMessage}>
                            Multiple BLE devices are advertising. Select which one to connect to:
                        </Text>
                        <View style={styles.deviceList}>
                            {discoveredDevices.map((device) => (
                                <TouchableOpacity
                                    key={device.id}
                                    style={styles.deviceRow}
                                    onPress={() => onSelectDevice(device)}
                                >
                                    <MaterialCommunityIcons
                                        name="bluetooth"
                                        size={24}
                                        color="#4CAF50"
                                        style={styles.deviceIcon}
                                    />
                                    <View style={styles.deviceInfo}>
                                        <Text variant="bodyLarge" style={styles.deviceName}>
                                            {device.name || 'Unknown Device'}
                                        </Text>
                                        <Text variant="bodySmall" style={styles.deviceId}>
                                            {device.id}
                                        </Text>
                                    </View>
                                    {device.rssi != null && device.rssi !== 127 && (
                                        <Text variant="bodySmall" style={styles.rssi}>
                                            {device.rssi} dBm
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={onDismiss}><Text>Cancel</Text></Button>
                    </Dialog.Actions>
                </Dialog>
            )}
        </Portal>
    )
}

const styles = StyleSheet.create({
    centered: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    spinner: {
        marginBottom: 16,
    },
    icon: {
        marginBottom: 16,
    },
    messageText: {
        textAlign: 'center',
        color: '#666',
    },
    selectMessage: {
        marginBottom: 16,
        color: '#666',
    },
    deviceList: {
        marginTop: 4,
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    deviceIcon: {
        marginRight: 12,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontWeight: '600',
    },
    deviceId: {
        color: '#999',
        marginTop: 2,
    },
    rssi: {
        color: '#999',
        marginLeft: 8,
    },
})
