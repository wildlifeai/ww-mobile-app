import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Chip, Divider, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWIcon } from '../../../components/ui/WWIcon'
import { useExtendedTheme } from '../../../theme'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
    isActive: boolean
    statusLabel: string
}

export const DeploymentHeroCard: React.FC<Props> = ({ deployment, isActive, statusLabel }) => {
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    const isValidDate = useCallback((date: any) => {
        if (!date) return false
        const d = new Date(date)
        return !isNaN(d.getTime()) && d.getTime() > 946684800000 // > Year 2000
    }, [])

    const getDurationString = useCallback((start: any, end: any) => {
        if (!isValidDate(start)) return ''
        const startDate = new Date(start)
        const endDate = isValidDate(end) ? new Date(end) : new Date()
        const diffMs = endDate.getTime() - startDate.getTime()
        if (diffMs < 0) return ''

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

        if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`
        if (hours > 0) return `${hours} hr ${minutes} min${minutes !== 1 ? 's' : ''}`
        return `${minutes} min${minutes !== 1 ? 's' : ''}`
    }, [isValidDate])

    const duration = useMemo(() => {
        return getDurationString(deployment.deploymentStart, deployment.deploymentEnd)
    }, [deployment.deploymentStart, deployment.deploymentEnd, getDurationString])

    return (
        <Card mode="outlined" style={styles.heroCard}>
            <Card.Content>
                {/* Status Badge */}
                <View style={styles.statusBadgeContainer}>
                    <Chip
                        icon={isActive ? "circle" : "check-circle"}
                        style={[
                            styles.statusBadge,
                            { backgroundColor: isActive ? colors.primaryContainer : colors.errorContainer }
                        ]}
                        textStyle={[
                            styles.statusBadgeText,
                            { color: isActive ? colors.onPrimaryContainer : colors.onErrorContainer }
                        ]}
                    >
                        <Text>{statusLabel}</Text>
                    </Chip>
                </View>

                {/* Deployment Name */}
                <WWText variant="headlineMedium" style={styles.deploymentName}>
                    {deployment.name || 'Unnamed Deployment'}
                </WWText>

                {/* Project Info */}
                {deployment.projectId && (
                    <View style={styles.infoRow}>
                        <WWIcon source="folder" size={16} color={colors.onSurfaceVariant} />
                        <WWText variant="bodyMedium" style={styles.infoText}>
                            Project ID: {deployment.projectId.slice(0, 8)}...
                        </WWText>
                    </View>
                )}

                <Divider style={styles.divider} />

                {/* Dates & Duration */}
                <View style={styles.datesGrid}>
                    <View style={styles.dateItem}>
                        <WWText variant="labelMedium" style={styles.label}><Text>Started</Text></WWText>
                        <WWText variant="bodyLarge" style={styles.dateValue}>
                            {isValidDate(deployment.deploymentStart) ? new Date(deployment.deploymentStart).toLocaleDateString() : 'N/A'}
                        </WWText>
                    </View>
                    {deployment.deploymentEnd && isValidDate(deployment.deploymentEnd) && (
                        <View style={styles.dateItem}>
                            <WWText variant="labelMedium" style={styles.label}><Text>Ended</Text></WWText>
                            <WWText variant="bodyLarge" style={styles.dateValue}>
                                {new Date(deployment.deploymentEnd).toLocaleDateString()}
                            </WWText>
                        </View>
                    )}
                    <View style={styles.dateItem}>
                        <WWText variant="labelMedium" style={styles.label}><Text>Duration</Text></WWText>
                        <WWText variant="bodyLarge" style={styles.dateValue}>
                            {duration || '--'}
                        </WWText>
                    </View>
                </View>
            </Card.Content>
        </Card>
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    heroCard: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    statusBadgeContainer: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 0,
        height: 32,
    },
    statusBadgeText: {
        fontWeight: 'bold'
    },
    deploymentName: {
        fontWeight: 'bold',
        marginBottom: 8,
        color: theme.colors.onSurface,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        marginLeft: 8,
        color: theme.colors.onSurfaceVariant,
    },
    divider: {
        marginVertical: 16,
        backgroundColor: theme.colors.outlineVariant,
    },
    datesGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
    },
    dateItem: {
        minWidth: '30%',
    },
    label: {
        color: theme.colors.onSurfaceVariant,
        marginBottom: 4,
    },
    dateValue: {
        fontWeight: '600',
        color: theme.colors.onSurface,
    },
})
