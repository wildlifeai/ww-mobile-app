
import { View, Text, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

interface ConsoleHeaderProps {
    deviceName: string | null;
    deviceId: string;
    isConnected: boolean;
    isConnecting: boolean;
    onConnect: () => void;
    onShowHelp: () => void;
    onShowFlows: () => void;
}

export const ConsoleHeader = ({
    deviceName,
    deviceId: _deviceId,
    isConnected,
    isConnecting,
    onConnect,
    onShowHelp,
    onShowFlows
}: ConsoleHeaderProps) => {
    const theme = useTheme();

    return (
        <>
            <View style={styles.header}>
                <View style={styles.nameRow}>
                    <View style={[styles.statusDot, isConnected ? styles.statusDotConnected : styles.statusDotDisconnected]} />
                    <Text style={styles.deviceName} numberOfLines={1}>{deviceName || 'Unknown Device'}</Text>
                </View>
                <View style={styles.buttonRow}>
                    <Button
                        mode="outlined"
                        compact
                        icon="console-line"
                        onPress={onShowHelp}
                    >
                        <Text>Commands</Text>
                    </Button>
                    <Button
                        mode="outlined"
                        compact
                        icon="chart-timeline-variant"
                        onPress={onShowFlows}
                    >
                        <Text>Flows</Text>
                    </Button>
                </View>
            </View>

            {!isConnected && (
                <Button
                    mode="contained"
                    onPress={onConnect}
                    disabled={isConnecting}
                    style={styles.connectButton}
                    buttonColor={theme.colors.primary}
                    textColor="#FFFFFF"
                    loading={isConnecting}
                >
                    <Text>Connect to Console</Text>
                </Button>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        marginRight: 8,
    },
    deviceName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    statusDotConnected: {
        backgroundColor: '#4CAF50',
    },
    statusDotDisconnected: {
        backgroundColor: '#F44336',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 6,
    },
    connectButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
});
