import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'

interface StatusItemProps {
    label: string
    value: string
    status: 'success' | 'warning' | 'error' | 'neutral'
    icon?: string
}

const StatusItem: React.FC<StatusItemProps> = ({ label, value, status, icon }) => {
    const getStatusColor = () => {
        switch (status) {
            case 'success': return '#4CAF50'
            case 'warning': return '#FFC107'
            case 'error': return '#F44336'
            default: return '#757575'
        }
    }

    return (
        <View style={styles.itemContainer}>
            <View style={styles.labelContainer}>
                {icon && <Image source={icon} style={[{ width: 16, height: 16, tintColor: '#666' }, styles.icon]} />}
                <Text style={styles.label}>{label}</Text>
            </View>
            <View style={styles.valueContainer}>
                <Text style={[styles.value, { color: getStatusColor() }]}>{value}</Text>
                {status === 'success' && <Image source="sf:checkmark.circle.fill" style={[{ width: 16, height: 16, tintColor: '#4CAF50' }, styles.statusIcon]} />}
                {status === 'error' && <Image source="sf:exclamationmark.circle.fill" style={[{ width: 16, height: 16, tintColor: '#F44336' }, styles.statusIcon]} />}
                {status === 'warning' && <Image source="sf:exclamationmark.triangle.fill" style={[{ width: 16, height: 16, tintColor: '#FFC107' }, styles.statusIcon]} />}
            </View>
        </View>
    )
}

interface DeviceStatusCardProps {
    batteryLevel?: number
    batteryVoltage?: number
    sdCardTotal?: number
    sdCardAvailable?: number
    firmwareVersion?: string
    aiModelVersion?: string
    lorawanStatus?: { rssi: number; snr: number }
}

export const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({
    batteryLevel,
    batteryVoltage,
    sdCardTotal,
    sdCardAvailable,
    firmwareVersion,
    aiModelVersion,
    lorawanStatus
}) => {
    const formatBytes = (bytes?: number) => {
        if (!bytes) return 'Unknown'
        const k = 1024
        const sizes = ['KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getBatteryStatus = () => {
        if (!batteryLevel) return 'neutral'
        if (batteryLevel > 50) return 'success'
        if (batteryLevel > 20) return 'warning'
        return 'error'
    }

    const getSdCardStatus = () => {
        if (!sdCardTotal) return 'neutral'
        if (!sdCardAvailable) return 'error'
        // Warning if less than 10% available
        if (sdCardAvailable / sdCardTotal < 0.1) return 'warning'
        return 'success'
    }

    const getLorawanStatus = () => {
        if (!lorawanStatus) return 'neutral'
        if (lorawanStatus.rssi > -100) return 'success'
        if (lorawanStatus.rssi > -120) return 'warning'
        return 'error'
    }

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Device Health</Text>

            <StatusItem
                label="Battery"
                value={batteryLevel ? `${batteryLevel}% (${batteryVoltage || '?'}mV)` : 'Unknown'}
                status={getBatteryStatus()}
                icon="sf:battery.100.bolt"
            />

            <StatusItem
                label="SD Card"
                value={sdCardTotal ? `${formatBytes(sdCardAvailable)} / ${formatBytes(sdCardTotal)} free` : 'Not Detected'}
                status={getSdCardStatus()}
                icon="sf:externaldrive.fill"
            />

            <StatusItem
                label="Firmware"
                value={firmwareVersion || 'Unknown'}
                status={firmwareVersion ? 'neutral' : 'warning'}
                icon="sf:cpu"
            />

            <StatusItem
                label="AI Model"
                value={aiModelVersion || 'Unknown'}
                status={aiModelVersion ? 'neutral' : 'warning'}
                icon="sf:eye.fill"
            />

            <StatusItem
                label="LoRaWAN"
                value={lorawanStatus ? `RSSI: ${lorawanStatus.rssi}, SNR: ${lorawanStatus.snr}` : 'Not Tested'}
                status={getLorawanStatus()}
                icon="sf:antenna.radiowaves.left.and.right"
            />
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#333',
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginRight: 8,
    },
    label: {
        fontSize: 14,
        color: '#666',
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    value: {
        fontSize: 14,
        fontWeight: '500',
    },
    statusIcon: {
        marginLeft: 6,
    }
})
