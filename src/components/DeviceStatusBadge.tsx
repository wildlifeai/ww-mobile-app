import React from 'react'
import { View, StyleSheet } from 'react-native'
import { WWText } from './ui/WWText'
import { DeviceStatus } from '../types/device'

interface DeviceStatusBadgeProps {
    status: DeviceStatus
}

export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({ status }) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'deployed':
                return {
                    label: 'Deployed',
                    backgroundColor: '#10B981', // green-500
                    color: '#FFFFFF',
                }
            case 'prepared':
                return {
                    label: 'Prepared',
                    backgroundColor: '#3B82F6', // blue-500
                    color: '#FFFFFF',
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
