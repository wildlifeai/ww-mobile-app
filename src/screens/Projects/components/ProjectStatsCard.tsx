import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, useTheme } from 'react-native-paper'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ProjectWithDetails } from '../../../types/project'

interface Props {
    project: ProjectWithDetails
    cloudMemberCount?: number
}

export const ProjectStatsCard: React.FC<Props> = ({ project, cloudMemberCount }) => {
    const theme = useTheme()

    const dynamicStyles = {
        statValue: { color: theme.colors.onSurface },
        statLabel: { color: theme.colors.onSurfaceVariant },
    }

    return (
        <View style={styles.statsContainer}>
            <Card mode="outlined" style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                    <WWIcon
                        source="account-group"
                        size={32}
                        color={theme.colors.primary}
                    />
                    <Text
                        variant="headlineSmall"
                        style={dynamicStyles.statValue}
                    >
                        {cloudMemberCount ?? project.member_count ?? 0}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={dynamicStyles.statLabel}
                    >
                        Members
                    </Text>
                </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                    <WWIcon
                        source="map-marker-multiple"
                        size={32}
                        color={theme.colors.primary}
                    />
                    <Text
                        variant="headlineSmall"
                        style={dynamicStyles.statValue}
                    >
                        {project.deployment_count || 0}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={dynamicStyles.statLabel}
                    >
                        Deployments
                        {` (${project.active_deployment_count || 0} active)`}
                    </Text>
                </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                    <WWIcon
                        source="access-point"
                        size={32}
                        color={theme.colors.primary}
                    />
                    <Text
                        variant="headlineSmall"
                        style={dynamicStyles.statValue}
                    >
                        {project.lorawan_device_count || 0}
                    </Text>
                    <Text
                        variant="bodySmall"
                        style={dynamicStyles.statLabel}
                    >
                        Devices
                    </Text>
                </Card.Content>
            </Card>
        </View>
    )
}

const styles = StyleSheet.create({
    statsContainer: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
    },
    statContent: {
        alignItems: "center",
        padding: 12,
        gap: 4,
    },
})
