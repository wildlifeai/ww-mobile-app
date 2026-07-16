import React, { useRef } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useTheme, Text } from 'react-native-paper'
import { useDeploymentMonitor, ActivityLogEntry } from '../hooks/useDeploymentMonitor'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'

interface LiveActivityLogProps {
    device: ExtendedPeripheral | null
    maxItems?: number
}

export const LiveActivityLog: React.FC<LiveActivityLogProps> = ({ 
    device,
    maxItems = 50
}) => {
    const theme = useTheme()
    const { activityLog } = useDeploymentMonitor(device)
    const scrollViewRef = useRef<ScrollView>(null)

    // Auto-scroll logic removed since we reverse render logic with newest at top, 
    // consistent with the previous StopMonitoringScreen layout.

    const displayLog = activityLog.slice(0, maxItems)

    if (displayLog.length === 0) {
        return (
            <View style={[styles.activityLogBox, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.emptyLogContainer}>
                    <MaterialCommunityIcons name="radar" size={32} color={theme.colors.onSurfaceVariant} style={styles.radarIcon} />
                    <Text style={[styles.emptyLogText, { color: theme.colors.onSurfaceVariant }]}>Waiting for device activity…</Text>
                </View>
            </View>
        )
    }

    return (
        <View style={[styles.activityLogBox, { backgroundColor: theme.colors.surface }]}>
            <ScrollView 
                ref={scrollViewRef}
                nestedScrollEnabled 
                showsVerticalScrollIndicator={false}
            >
                {displayLog.map((item: ActivityLogEntry) => (
                    <View key={item.id} style={styles.logEntry}>
                        <MaterialCommunityIcons 
                            name={item.icon} 
                            size={16} 
                            color={getEventColor(item.category, theme)} 
                            style={styles.logEntryIcon} 
                        />
                        <View style={styles.logEntryContent}>
                            <Text style={[styles.logEntryLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>
                                {item.label}
                            </Text>
                            {!!item.details && (
                                <Text style={[styles.logEntryDetails, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                                    {item.details}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.logEntryTime, { color: theme.colors.onSurfaceVariant }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    )
}

// Helper function to map categories to specific UI colors
function getEventColor(category: string, theme: any) {
    switch (category) {
        case 'capture':
        case 'nn_positive':
        case 'selftest_ok':
            return theme.colors.primary // Or a specific success color if available
        case 'wake':
        case 'info':
            return theme.colors.primary
        case 'sleep':
            return theme.colors.onSurfaceVariant
        case 'selftest_warn':
        case 'motion_rejected':
            return theme.colors.error
        case 'motion':
            return theme.colors.tertiary || '#FF9800'
        case 'timelapse':
            return '#9C27B0'
        default:
            return theme.colors.onSurfaceVariant
    }
}

const styles = StyleSheet.create({
    activityLogBox: {
        borderRadius: 12,
        padding: 8,
        maxHeight: 220,
        minHeight: 100,
    },
    emptyLogContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    emptyLogText: {
        marginTop: 8,
        fontSize: 13,
    },
    radarIcon: {
        opacity: 0.5
    },
    logEntry: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    logEntryIcon: {
        marginRight: 8,
        marginTop: 2, // Align with first line of text
        alignSelf: 'flex-start',
    },
    logEntryContent: {
        flex: 1,
        justifyContent: 'center',
    },
    logEntryLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    logEntryDetails: {
        fontSize: 11,
        marginTop: 2,
    },
    logEntryTime: {
        fontSize: 11,
        marginLeft: 8,
        alignSelf: 'flex-start', // Align right at the top of the entry
        marginTop: 2,
    }
})
