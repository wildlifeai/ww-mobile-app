import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Divider } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWIcon } from '../../../components/ui/WWIcon'
import { useExtendedTheme } from '../../../theme'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
}

export const DeploymentDeviceCard: React.FC<Props> = ({ deployment }) => {
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    const renderDeviceIcon = useCallback((props: any) => (
        <WWIcon {...props} source="cellphone" size={24} color={colors.onSurface} />
    ), [colors.onSurface])

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Title
                title="Device"
                titleStyle={styles.cardTitle}
                left={renderDeviceIcon}
            />
            <Card.Content>
                <View style={styles.infoRow}>
                    <WWText variant="labelMedium" style={styles.infoLabel}>Device ID:</WWText>
                    <WWText variant="bodyMedium" style={styles.valueText}>
                        {deployment.deviceId || 'Unknown'}
                    </WWText>
                </View>

                <Divider style={styles.smallDivider} />
                <View style={styles.statusPlaceholder}>
                    <WWIcon source="access-point" size={20} color={colors.onSurfaceVariant} />
                    <WWText variant="bodySmall" style={styles.placeholderText}>
                        Device status via LoRaWAN
                    </WWText>
                </View>
            </Card.Content>
        </Card>
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    card: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    cardTitle: {
        color: theme.colors.onSurface,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoLabel: {
        color: theme.colors.onSurfaceVariant,
        width: 140,
    },
    valueText: {
        color: theme.colors.onSurface,
        flex: 1,
    },
    smallDivider: {
        marginVertical: 12,
        backgroundColor: theme.colors.outlineVariant,
    },
    statusPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.elevation.level1,
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    placeholderText: {
        color: theme.colors.onSurfaceVariant,
        flex: 1,
    },
})
