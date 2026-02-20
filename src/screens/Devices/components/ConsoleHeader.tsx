
import { View, Text, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

interface ConsoleHeaderProps {
    deviceName: string | null;
    deviceId: string;
    isConnected: boolean;
    isConnecting: boolean;
    onConnect: () => void;
    onShowHelp: () => void;
}

export const ConsoleHeader = ({
    deviceName,
    deviceId,
    isConnected,
    isConnecting,
    onConnect,
    onShowHelp
}: ConsoleHeaderProps) => {
    const theme = useTheme();

    return (
        <>
            <View style={styles.header}>
                <View>
                    <Text style={styles.deviceName}>{deviceName || 'Unknown Device'}</Text>
                    <Text style={styles.deviceId}>{deviceId}</Text>
                </View>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, isConnected ? styles.statusDotConnected : styles.statusDotDisconnected]} />
                    <Text style={styles.statusText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
                    <Button
                        mode="outlined"
                        compact
                        onPress={onShowHelp}
                        style={styles.helpButton}
                    >
                        Command Reference
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
                    Connect to Console
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
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    deviceName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    deviceId: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusDotConnected: {
        backgroundColor: '#4CAF50',
    },
    statusDotDisconnected: {
        backgroundColor: '#F44336',
    },
    statusText: {
        fontSize: 14,
        color: '#666',
    },
    connectButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    helpButton: {
        marginLeft: 8,
    }
});
