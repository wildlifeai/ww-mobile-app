import { View, StyleSheet } from 'react-native'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'
import { ActivityIndicator, Button, Text, IconButton, ProgressBar, useTheme } from 'react-native-paper'
import { Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppDrawer } from '../../components/AppDrawer'

import { useDeviceDiscovery } from './hooks/useDeviceDiscovery'
import { ScannerRoutingDialog } from './components/ScannerRoutingDialog'

interface Props {
    isActiveTab?: boolean
}

export const DeviceDiscoveryScreen: React.FC<Props> = ({ isActiveTab }) => {
    const theme = useTheme()
    const { setIsOpen, isOpen } = useAppDrawer()

    const {
        connectingDevice,
        connectionLogs,
        processing,
        // Scan session
        scanSessionState,
        scanSecondsRemaining,
        startScanSession,
        // Scanner Routing Dialog
        routingState,
        routingParams,
        routingIsProcessing,
        handleRoutingCreateProject,
        handleRoutingDismiss,
    } = useDeviceDiscovery({ isDrawerOpen: isOpen, isActiveTab })



    if (processing && connectingDevice) {
        const latestLog = connectionLogs.length > 0 ? connectionLogs[connectionLogs.length - 1] : 'Initializing…'
        // Cap progress at 95% until complete (Using 8 as a good median for deployment connection logs)
        const progressValue = Math.min((connectionLogs.length / 8), 0.95)

        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <OfflineIndicator />

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

                {/* Scanner Routing Dialog (Rendered in Connecting State) */}
                <ScannerRoutingDialog
                    visible={routingState !== 'idle'}
                    state={routingState}
                    params={routingParams}
                    isProcessing={routingIsProcessing}
                    onCreateProject={handleRoutingCreateProject}
                    onDismiss={handleRoutingDismiss}
                />
            </SafeAreaView>
        )
    }

    // Format remaining time as M:SS
    const minutes = Math.floor(scanSecondsRemaining / 60)
    const seconds = scanSecondsRemaining % 60
    const countdownText = `${minutes}:${String(seconds).padStart(2, '0')}`
    const scanProgress = 1 - (scanSecondsRemaining / 60)

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <OfflineIndicator />
            <View style={styles.container}>
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
                <View style={styles.autoEmptyState}>
                    <View style={styles.centerContent}>
                        <View style={styles.graphicContainer}>
                            <Image 
                                source={require('../../../assets/press_button_example.png')} 
                                style={styles.scannerImage}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Expired state: no device found after 60s */}
                        {scanSessionState === 'expired' && (
                            <>
                                <Text variant="headlineMedium" style={styles.autoTitleBold}>
                                    No devices found
                                </Text>
                                <Text variant="bodyMedium" style={styles.subtitleText}>
                                    Make sure your device is nearby and press its middle button to start Bluetooth advertising.
                                </Text>
                                <Button
                                    mode="contained"
                                    icon="magnify"
                                    onPress={startScanSession}
                                    style={styles.searchButton}
                                    contentStyle={styles.searchButtonContent}
                                    labelStyle={styles.searchButtonLabel}
                                >
                                    <Text>Search Again</Text>
                                </Button>
                            </>
                        )}

                        {/* Active session: scanning with countdown */}
                        {scanSessionState === 'active' && (
                            <>
                                <Text variant="headlineMedium" style={styles.autoTitleBold}>
                                    Press the middle button on your device to connect to it
                                </Text>

                                <View style={styles.countdownContainer}>
                                    <ProgressBar
                                        progress={scanProgress}
                                        color={theme.colors.primary}
                                        style={styles.countdownBar}
                                    />
                                    <View style={[styles.scanningLogContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <ActivityIndicator size={16} color={theme.colors.primary} />
                                        <Text style={[styles.scanningLogText, { color: theme.colors.primary }]}>
                                            Searching for devices… {countdownText}
                                        </Text>
                                    </View>
                                </View>

                                <Button
                                    mode="outlined"
                                    icon="refresh"
                                    onPress={startScanSession}
                                    style={styles.restartButton}
                                >
                                    <Text>Restart Search</Text>
                                </Button>
                            </>
                        )}

                        {/* Suspended state: session paused by navigation, will resume on focus */}
                        {scanSessionState === 'suspended' && (
                            <>
                                <Text variant="headlineMedium" style={styles.autoTitleBold}>
                                    Search paused
                                </Text>
                                <Text variant="bodyMedium" style={styles.subtitleText}>
                                    The search will resume automatically, or you can start a new search.
                                </Text>
                                <Button
                                    mode="contained"
                                    icon="magnify"
                                    onPress={startScanSession}
                                    style={styles.searchButton}
                                    contentStyle={styles.searchButtonContent}
                                    labelStyle={styles.searchButtonLabel}
                                >
                                    <Text>New Search</Text>
                                </Button>
                            </>
                        )}

                        {/* Initial state: no session started yet */}
                        {scanSessionState === 'idle' && (
                            <>
                                <Text variant="headlineMedium" style={styles.autoTitleBold}>
                                    Press the middle button on your device, then search
                                </Text>
                                <Button
                                    mode="contained"
                                    icon="magnify"
                                    onPress={startScanSession}
                                    style={styles.searchButton}
                                    contentStyle={styles.searchButtonContent}
                                    labelStyle={styles.searchButtonLabel}
                                >
                                    <Text>Search for Devices</Text>
                                </Button>
                            </>
                        )}
                    </View>
                </View>
            </View>

            {/* Scanner Routing Dialog */}
            <ScannerRoutingDialog
                visible={routingState !== 'idle'}
                state={routingState}
                params={routingParams}
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
    },
    searchButton: {
        marginTop: 8,
        borderRadius: 28,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
    },
    searchButtonContent: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    searchButtonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    restartButton: {
        marginTop: 16,
        borderRadius: 28,
    },
    countdownContainer: {
        width: '100%',
        marginTop: 8,
    },
    countdownBar: {
        height: 4,
        borderRadius: 2,
        marginBottom: 8,
    },
    subtitleText: {
        textAlign: 'center',
        opacity: 0.7,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
})
