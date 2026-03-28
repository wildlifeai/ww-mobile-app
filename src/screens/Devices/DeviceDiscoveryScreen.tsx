import { View, FlatList, StyleSheet } from 'react-native'
import { useCallback } from 'react'
import { WWButton } from '../../components/ui/WWButton'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'
import { ActivityIndicator, Text, IconButton, ProgressBar, useTheme } from 'react-native-paper'
import { Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppDrawer } from '../../components/AppDrawer'

import { DeviceItem } from '../../components/DeviceItem'
import { useDeviceDiscovery } from './hooks/useDeviceDiscovery'
import { ScannerRoutingDialog } from './components/ScannerRoutingDialog'

export const DeviceDiscoveryScreen = () => {
    const theme = useTheme()
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
        routingIsProcessing,
        handleRoutingCreateProject,
        handleRoutingDismiss,
    } = useDeviceDiscovery({ isDrawerOpen: isOpen })

    const renderEmptyState = () => {
        if (mode === 'auto') {
            return (
                <View style={styles.autoEmptyState}>
                    <View style={styles.centerContent}>
                        <View style={styles.graphicContainer}>
                            <Image 
                                source={require('../../../assets/press_button_example.png')} 
                                style={styles.scannerImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text variant="headlineMedium" style={styles.autoTitleBold}>
                            Press the middle button on your device to connect to it
                        </Text>
                        
                        <View style={[styles.scanningLogContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <ActivityIndicator size={16} color={theme.colors.primary} />
                            <Text style={[styles.scanningLogText, { color: theme.colors.primary }]}>Searching for BLE connections...</Text>
                        </View>
                    </View>
                </View>
            )
        }

        return (
            <View style={styles.emptyState}>
                {isScanning ? (
                    <>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="bodyLarge" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            Scanning for nearby devices...
                        </Text>
                    </>
                ) : (
                    <>
                        <Text variant="titleMedium" style={styles.emptyTitle}>
                            No Devices Found
                        </Text>
                        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up.
                        </Text>
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <OfflineIndicator />
                <View style={styles.headerContainer}>
                    <IconButton
                        icon="arrow-left"
                        iconColor={theme.colors.onSurface}
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
                        <ProgressBar progress={progressValue} color={theme.colors.primary} style={styles.progressBar} />
                        
                        <View style={styles.singleLogRow}>
                            <ActivityIndicator size={14} color={theme.colors.primary} style={styles.logIconSmall} />
                            <Text style={styles.singleLogText} numberOfLines={1}>
                                {latestLog}
                            </Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <OfflineIndicator />
            <View style={styles.container}>
                {/* Non-auto modes: Header + Scan Button + Device List */}
                {mode !== 'auto' && (
                    <>
                        <View style={styles.headerContainer}>
                            <IconButton
                                icon="menu"
                                iconColor={theme.colors.onSurface}
                                size={28}
                                style={styles.menuIcon}
                                onPress={() => setIsOpen(true)}
                            />
                            <Text variant="headlineMedium" style={styles.title}>
                                Wildlife Watcher Scan
                            </Text>
                        </View>
                        <View style={styles.headerView}>
                            <View style={styles.buttonRow}>
                                <WWButton
                                    mode="contained"
                                    onPress={handleScan}
                                    loading={isScanning}
                                    style={[styles.scanButton, { backgroundColor: theme.colors.primary }]}
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

                {/* Auto mode: Header + scanning empty state */}
                {mode === 'auto' && (
                    <>
                        <View style={styles.headerContainer}>
                            <IconButton
                                icon="menu"
                                iconColor={theme.colors.onSurface}
                                size={28}
                                style={styles.menuIcon}
                                onPress={() => setIsOpen(true)}
                            />
                            <Text variant="headlineMedium" style={styles.autoHeaderTitle} numberOfLines={1}>
                                Wildlife Watcher Scan
                            </Text>
                        </View>
                        {renderEmptyState()}
                    </>
                )}
            </View>

            {/* Scanner Routing Dialog */}
            <ScannerRoutingDialog
                visible={routingState !== 'idle'}
                state={routingState}
                isProcessing={routingIsProcessing}
                onCreateProject={handleRoutingCreateProject}
                onDismiss={handleRoutingDismiss}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    title: {
        flex: 1,
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
        marginBottom: 16,
    },
    autoEmptyState: {
        flex: 1,
    },
    menuIcon: {
        margin: 0,
        marginRight: 4,
    },
    autoHeaderTitle: {
        fontWeight: 'bold',
        flex: 1,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 60,
        paddingHorizontal: 24,
    },
    connectingTitle: {
        marginBottom: 24,
        fontWeight: '600',
        textAlign: 'center',
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
        fontWeight: 'bold',
        marginBottom: 24,
    },
    scanningLogContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
    },
    scanningLogText: {
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
        fontSize: 14,
    }
})
