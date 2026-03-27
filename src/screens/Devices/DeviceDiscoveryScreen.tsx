import { View, FlatList, StyleSheet } from 'react-native'
import { useCallback } from 'react'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { ActivityIndicator, Text, IconButton, ProgressBar } from 'react-native-paper'
import { Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppDrawer } from '../../components/AppDrawer'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

import { DeviceItem } from '../../components/DeviceItem'
import { useDeviceDiscovery } from './hooks/useDeviceDiscovery'
import { ScannerRoutingDialog } from './components/ScannerRoutingDialog'

export const DeviceDiscoveryScreen = () => {
    const insets = useSafeAreaInsets()
    const { setIsOpen, isOpen } = useAppDrawer()

    const {
        devicesToDisplay,
        isAnyDeviceConnecting,
        isScanning,
        mode,
        handleScan,
        handleDeviceSelect,
        handleDisconnect,
        connectingDevice,
        connectionLogs,
        processing,
        // Scanner Routing Dialog
        routingState,
        routingProjects,
        routingDeviceName,
        routingIsProcessing,
        handleRoutingStartDeployment,
        handleRoutingStopDeployment,
        handleRoutingCreateProject,
        handleRoutingAssociateDevice,
        handleRoutingDismiss,
    } = useDeviceDiscovery({ isDrawerOpen: isOpen })

    const renderEmptyState = () => {
        if (mode === 'auto') {
            return (
                <View style={[styles.autoEmptyState, { paddingTop: insets.top + 16 }]}>
                    <View style={styles.customHeader}>
                        <IconButton
                            icon="menu"
                            iconColor="#FFFFFF"
                            size={28}
                            style={styles.menuIcon}
                            onPress={() => setIsOpen(true)}
                        />
                        <Text variant="headlineSmall" style={styles.autoHeaderTitle} numberOfLines={2}>
                            Scanning for Wildlife Watchers
                        </Text>
                    </View>

                    <View style={styles.centerContent}>
                        <View style={styles.graphicContainer}>
                        <Image 
                            source={require('../../../assets/press_button_example.png')} 
                            style={styles.scannerImage}
                            resizeMode="contain"
                        />
                    </View>

                        <WWText variant="headlineMedium" style={styles.autoTitleBold}>
                            <Text>Press the middle button on your device to connect to it</Text>
                        </WWText>
                        
                        <View style={styles.scanningLogContainer}>
                            <ActivityIndicator size={16} color="#4CAF50" />
                            <Text style={styles.scanningLogText}>Searching for BLE connections...</Text>
                        </View>
                    </View>
                </View>
            )
        }

        return (
            <View style={styles.emptyState}>
                {isScanning ? (
                    <>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <WWText variant="bodyLarge" style={styles.emptyText}>
                            <Text>Scanning for nearby devices...</Text>
                        </WWText>
                    </>
                ) : (
                    <>
                        <WWText variant="titleMedium" style={styles.emptyTitle}>
                            <Text>No Devices Found</Text>
                        </WWText>
                        <WWText variant="bodyMedium" style={styles.emptyText}>
                            <Text>To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up.</Text>
                        </WWText>
                    </>
                )}
            </View>
        )
    }

    const renderDeviceItem = useCallback(({ item }: { item: any }) => (
        <DeviceItem
            disabled={isAnyDeviceConnecting}
            item={item}
            disconnect={handleDisconnect}
            go={handleDeviceSelect}
            upgrade={() => { }} // No-op for selection screen
        />
    ), [isAnyDeviceConnecting, handleDisconnect, handleDeviceSelect])

    if (processing && connectingDevice && mode === 'auto') {
        const latestLog = connectionLogs.length > 0 ? connectionLogs[connectionLogs.length - 1] : 'Initializing...'
        // Cap progress at 95% until complete
        const progressValue = Math.min((connectionLogs.length / 5), 0.95)

        return (
            <WWScreenView scrollable={false}>
                <View style={[styles.container, styles.autoEmptyState, { paddingTop: insets.top + 16 }]}>
                    <View style={styles.customHeader}>
                        <IconButton
                            icon="arrow-left"
                            iconColor="#FFFFFF"
                            size={28}
                            style={styles.menuIcon}
                            onPress={() => {
                                // Provide an out if it gets stuck
                                handleDisconnect(connectingDevice)
                            }}
                        />
                    </View>

                    <View style={styles.centerContent}>
                        <View style={styles.graphicContainer}>
                            <Image 
                                source={require('../../../assets/connecting device.png')} 
                                style={styles.scannerImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text variant="titleLarge" style={styles.connectingTitle}>
                            Connecting to {connectingDevice.name || connectingDevice.id}
                        </Text>
                        
                        <View style={styles.progressSection}>
                            <ProgressBar progress={progressValue} color="#4CAF50" style={styles.progressBar} />
                            
                            <View style={styles.singleLogRow}>
                                <ActivityIndicator size={14} color="#4CAF50" style={styles.logIconSmall} />
                                <Text style={styles.singleLogText} numberOfLines={1}>
                                    {latestLog}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable={false}>
            <View style={[styles.container, mode === 'auto' && styles.autoContainer]}>
                {/* Non-auto modes: Header + Scan Button + Device List */}
                {mode !== 'auto' && (
                    <>
                        <View style={styles.header}>
                            <WWText variant="titleLarge" style={styles.title}>
                                <Text>Select Device</Text>
                            </WWText>
                        </View>
                        <View style={styles.headerView}>
                            <View style={styles.buttonRow}>
                                <WWButton
                                    mode="contained"
                                    onPress={handleScan}
                                    loading={isScanning}
                                    style={styles.scanButton}
                                >
                                    <Text>{isScanning ? 'Scanning' : 'Scan'}</Text>
                                </WWButton>
                            </View>
                        </View>
                        <FlatList
                            data={devicesToDisplay}
                            renderItem={renderDeviceItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={renderEmptyState}
                        />
                    </>
                )}

                {/* Auto mode: only show scanning empty state (connecting UI is handled above) */}
                {mode === 'auto' && renderEmptyState()}
            </View>

            {/* Scanner Routing Dialog */}
            <ScannerRoutingDialog
                visible={routingState !== 'idle'}
                state={routingState}
                deviceName={routingDeviceName}
                projects={routingProjects}
                isProcessing={routingIsProcessing}
                onStartDeployment={handleRoutingStartDeployment}
                onStopDeployment={handleRoutingStopDeployment}
                onCreateProject={handleRoutingCreateProject}
                onAssociateDevice={handleRoutingAssociateDevice}
                onDismiss={handleRoutingDismiss}
            />
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
    },
    headerView: {
        marginBottom: 16,
        alignItems: 'center',
    },
    buttonRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    scanButton: {
        flex: 1,
        backgroundColor: '#4CAF50',
    },
    listContent: {
        flexGrow: 1,
        paddingHorizontal: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: '#6B7280',
        marginBottom: 16,
    },
    autoContainer: {
        backgroundColor: '#1E1E1E',
    },
    autoEmptyState: {
        flex: 1,
        paddingHorizontal: 24,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    menuIcon: {
        marginLeft: -8,
        marginRight: 8,
    },
    autoHeaderTitle: {
        color: '#FFFFFF',
        fontWeight: '600',
        flex: 1,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 60,
    },
    connectingTitle: {
        marginBottom: 24,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    connectingSpinner: {
        marginBottom: 40,
    },
    logsContainer: {
        width: '100%',
        paddingHorizontal: 8,
        alignItems: 'flex-start',
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    logIcon: {
        marginRight: 16,
    },
    logText: {
        fontSize: 16,
        flex: 1,
    },
    logTextActive: {
        color: '#FFFFFF',
    },
    logTextInactive: {
        color: '#BDBDBD',
    },
    graphicContainer: {
        width: '100%',
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    scannerImage: {
        width: '100%',
        height: '100%',
    },
    autoTitleBold: {
        textAlign: 'center',
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginBottom: 24,
    },
    autoSubtitle: {
        textAlign: 'center',
        color: '#BDBDBD',
        marginBottom: 40,
    },
    scanningLogContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        justifyContent: 'center',
    },
    scanningLogText: {
        color: '#4CAF50',
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '500',
    },
    progressSection: {
        width: '100%',
        paddingHorizontal: 32,
        marginTop: 16,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#333333',
        marginBottom: 16,
    },
    singleLogRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logIconSmall: {
        marginRight: 8,
    },
    singleLogText: {
        color: '#FFFFFF',
        fontSize: 14,
    }
})
