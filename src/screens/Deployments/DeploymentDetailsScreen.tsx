import React, { useLayoutEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNavigation, RouteProp } from '@react-navigation/native'
import { IconButton, Menu, Card, Text } from 'react-native-paper'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { of } from 'rxjs'
import { map } from 'rxjs/operators'
import database from '../../database'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'

import { WWIcon } from '../../components/ui/WWIcon'

import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../services/DeploymentService'
import type Deployment from '../../database/models/Deployment'
import type Device from '../../database/models/Device'
import type Project from '../../database/models/Project'
import type User from '../../database/models/User'
import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { selectCurrentUser } from '../../redux/slices/authSlice'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetails'>

interface Props {
    deployment: Deployment
    device: Device | null
    project: Project | null
    setupUser: User | null
}

const DeploymentDetailsScreenComponent: React.FC<Props> = ({ deployment, device, project, setupUser }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const [menuVisible, setMenuVisible] = React.useState(false)
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    // Status helpers
    const isActive = !deployment.deploymentEnd

    // Duration calculation
    const activeDuration = useMemo(() => {
        if (!deployment.deploymentStart) return '--'
        const start = new Date(deployment.deploymentStart)
        if (isNaN(start.getTime()) || start.getTime() < 946684800000) return '--'
        const end = deployment.deploymentEnd ? new Date(deployment.deploymentEnd) : new Date()
        const diffMs = end.getTime() - start.getTime()
        if (diffMs < 0) return '--'

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

        if (days > 0) return `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`
        return `${hours} hour${hours !== 1 ? 's' : ''}`
    }, [deployment.deploymentStart, deployment.deploymentEnd])

    const currentUser = useAppSelector(selectCurrentUser)

    // User display name
    const deployedByName = useMemo(() => {
        if (setupUser?.firstname || setupUser?.surname) {
            return `${setupUser?.firstname || ''} ${setupUser?.surname || ''}`.trim()
        }
        if (currentUser?.id === deployment.setupBy) {
            const profile = currentUser.profile as any
            const first = profile?.firstName || profile?.firstname || ''
            const last = profile?.lastName || profile?.surname || ''
            if (first || last) return `${first} ${last}`.trim()
            return 'Me'
        }
        return deployment.setupBy ? deployment.setupBy.slice(0, 8) + '...' : 'Unknown'
    }, [setupUser, deployment.setupBy, currentUser])

    // Device display name (title)
    const deviceName = device?.name || deployment.locationName || 'Unknown Device'

    const renderHeaderRight = useCallback(() => (
        isActive ? (
            <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
            >
                <Menu.Item
                    onPress={() => {
                        setMenuVisible(false)
                        navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)
                    }}
                    title="End Monitoring"
                    leadingIcon="stop"
                />
            </Menu>
        ) : null
    ), [isActive, menuVisible, navigation])

    // Configure header
    useLayoutEffect(() => {
        navigation.setOptions({
            title: deviceName,
            headerRight: renderHeaderRight,
        })
    }, [navigation, deviceName, renderHeaderRight])

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText><Text>Monitoring session not found.</Text></WWText>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable>
            <View style={styles.container}>
                {/* Summary Info Card */}
                <Card mode="outlined" style={styles.summaryCard}>
                    <Card.Content style={styles.summaryContent}>
                        {/* Location Name */}
                        <View style={styles.infoRow}>
                            <WWIcon source="tag" size={18} color={colors.onSurfaceVariant} />
                            <View style={styles.infoTextGroup}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>
                                    <Text>Location Name</Text>
                                </WWText>
                                <WWText variant="bodyLarge" style={styles.infoValue}>
                                    <Text>{deployment.locationName || 'Unknown'}</Text>
                                </WWText>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Project */}
                        <View style={styles.infoRow}>
                            <WWIcon source="folder" size={18} color={colors.onSurfaceVariant} />
                            <View style={styles.infoTextGroup}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>
                                    <Text>Project</Text>
                                </WWText>
                                <WWText variant="bodyLarge" style={styles.infoValue}>
                                    <Text>{project?.name || 'Unknown Project'}</Text>
                                </WWText>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Active for */}
                        <View style={styles.infoRow}>
                            <WWIcon source="clock-outline" size={18} color={colors.onSurfaceVariant} />
                            <View style={styles.infoTextGroup}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>
                                    <Text>Active for</Text>
                                </WWText>
                                <WWText variant="bodyLarge" style={styles.infoValue}>
                                    <Text>{activeDuration}</Text>
                                </WWText>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Deployed by */}
                        <View style={styles.infoRow}>
                            <WWIcon source="account" size={18} color={colors.onSurfaceVariant} />
                            <View style={styles.infoTextGroup}>
                                <WWText variant="labelMedium" style={styles.infoLabel}>
                                    <Text>Started by</Text>
                                </WWText>
                                <WWText variant="bodyLarge" style={styles.infoValue}>
                                    <Text>{deployedByName}</Text>
                                </WWText>
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            </View>
        </WWScreenView>
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        padding: theme.spacing * 1.6,
    },
    summaryCard: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    summaryContent: {
        paddingVertical: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    infoTextGroup: {
        flex: 1,
    },
    infoLabel: {
        color: theme.colors.onSurfaceVariant,
        marginBottom: 2,
    },
    infoValue: {
        color: theme.colors.onSurface,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.outlineVariant,
    },
    actionSection: {
        gap: 12,
        marginTop: 8,
        marginBottom: 24,
    },
    actionButton: {
        borderRadius: 8,
    },
})

// Enhance with WatermelonDB observables - fetch deployment + related records
const enhance = withObservables(['route'], ({ route }: { route: DeploymentDetailsRouteProp }) => {
    const deployment$ = DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
    return {
        deployment: deployment$,
    }
})

// Second HOC layer: once deployment is resolved, observe its relations
const enhanceRelations = withObservables(['deployment'], ({ deployment }: { deployment: Deployment }) => ({
    device: deployment.deviceId 
        ? database.get<Device>('devices').query(Q.where('id', deployment.deviceId)).observe().pipe(map(devices => devices[0] || null))
        : of(null),
    project: deployment.projectId 
        ? database.get<Project>('projects').query(Q.where('id', deployment.projectId)).observe().pipe(map(projects => projects[0] || null))
        : of(null),
    setupUser: deployment.setupBy 
        ? database.get<User>('users').query(Q.where('id', deployment.setupBy)).observe().pipe(map(users => users[0] || null))
        : of(null),
}))

const EnhancedComponent = enhanceRelations(DeploymentDetailsScreenComponent)
export const DeploymentDetailsScreen = enhance(EnhancedComponent)

