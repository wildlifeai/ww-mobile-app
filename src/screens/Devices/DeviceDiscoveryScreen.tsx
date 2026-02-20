import { View, FlatList, StyleSheet } from 'react-native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { ActivityIndicator } from 'react-native-paper'

import { DeviceItem } from '../../components/DeviceItem'
import { useDeviceDiscovery } from './hooks/useDeviceDiscovery'

export const DeviceDiscoveryScreen = () => {
    const {
        devicesToDisplay,
        isAnyDeviceConnecting,
        isScanning,
        mode,
        handleScan,
        handleDeviceSelect,
        handleDisconnect
    } = useDeviceDiscovery()

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            {isScanning ? (
                <>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <WWText variant="bodyLarge" style={styles.emptyText}>
                        Scanning for nearby devices...
                    </WWText>
                </>
            ) : (
                <>
                    <WWText variant="titleMedium" style={styles.emptyTitle}>
                        No Devices Found
                    </WWText>
                    <WWText variant="bodyMedium" style={styles.emptyText}>
                        To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up.
                    </WWText>
                </>
            )}
        </View>
    )

    return (
        <WWScreenView scrollable={false}>
            <View style={styles.container}>
                {/* Header Title based on mode */}
                <View style={styles.header}>
                    <WWText variant="titleLarge" style={styles.title}>
                        {mode === 'prepare' ? 'Select Device to Prepare' :
                         mode === 'deployment' ? 'Select Device to Deploy' :
                         'Engineer Console: Select Device'}
                    </WWText>
                </View>

                {/* Scan Button */}
                <View style={styles.headerView}>
                    <View style={styles.buttonRow}>
                        <WWButton
                            mode="contained"
                            onPress={handleScan}
                            loading={isScanning}
                            style={styles.scanButton}
                        >
                            {isScanning ? 'Scanning' : 'Scan'}
                        </WWButton>
                    </View>
                </View>

                {/* Devices List */}
                <FlatList
                    data={devicesToDisplay}
                    renderItem={({ item }) => (
                        <DeviceItem
                            disabled={isAnyDeviceConnecting}
                            item={item}
                            disconnect={handleDisconnect}
                            go={handleDeviceSelect}
                            upgrade={() => { }} // No-op for selection screen
                        />
                    )}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                />
            </View>
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
})
