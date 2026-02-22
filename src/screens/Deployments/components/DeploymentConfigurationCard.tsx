import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWIcon } from '../../../components/ui/WWIcon'
import { useExtendedTheme } from '../../../theme'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment
    captureMethodName: string
    sensitivityName: string
}

export const DeploymentConfigurationCard: React.FC<Props> = ({ deployment, captureMethodName, sensitivityName }) => {
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    const renderProjectDetailsLeft = useCallback((props: any) => (
        <WWIcon {...props} source="cog" size={24} color={colors.onSurface} />
    ), [colors.onSurface])

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Title
                title="Project details"
                titleStyle={styles.cardTitle}
                left={renderProjectDetailsLeft}
            />
            <Card.Content>
                <View style={styles.deviceInfo}>
                    <View style={styles.infoRow}>
                        <WWText variant="labelMedium" style={styles.infoLabel}><Text>Capture Method:</Text></WWText>
                        <WWText variant="bodyMedium" style={styles.valueText}>
                            {captureMethodName}
                        </WWText>
                    </View>

                    {deployment.captureMethodId === 1 && (
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium" style={styles.infoLabel}><Text>Sensitivity:</Text></WWText>
                            <WWText variant="bodyMedium" style={styles.valueText}>
                                {sensitivityName}
                            </WWText>
                        </View>
                    )}
                    {deployment.captureMethodId === 2 && deployment.timelapseIntervalSeconds && (
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium" style={styles.infoLabel}><Text>Interval:</Text></WWText>
                            <WWText variant="bodyMedium" style={styles.valueText}>
                                <Text>{deployment.timelapseIntervalSeconds}s</Text>
                            </WWText>
                        </View>
                    )}
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
    deviceInfo: {
        gap: 8,
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
})
