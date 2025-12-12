import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import { WWText } from './ui/WWText'
import { DeviceStatus } from '../types/device'

interface DeviceStatusBadgeProps {
    status: DeviceStatus
}

export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({ status }) => {
    const theme = useTheme()

    const getStatusConfig = () => {
        switch (status) {
            case 'deployed':
                return {
                    label: 'Deployed',
                    backgroundColor: '#10B981', // Standard success green
                    color: '#FFFFFF',
                }
            case 'prepared':
                return {
                    label: 'Prepared',
                    backgroundColor: theme.colors.primary, // APP GREEN
                    color: theme.colors.onPrimary,
                }
            case 'needs_preparation':
                return {
                    label: 'Needs Preparation',
                    backgroundColor: '#F59E0B', // yellow-500
                    color: '#FFFFFF',
                }
        }
    }

    const config = getStatusConfig()

    return (
        <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
            <WWText variant="labelSmall" style={{ color: config.color }}>
                {config.label}
            </WWText>
        </View>
    )
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
})
