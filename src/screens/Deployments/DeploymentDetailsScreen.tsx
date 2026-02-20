import React, { useLayoutEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNavigation, RouteProp } from '@react-navigation/native'
import { IconButton, Menu } from 'react-native-paper'
import { withObservables } from '@nozbe/watermelondb/react'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'

import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../services/DeploymentService'
import type Deployment from '../../database/models/Deployment'
import { DeploymentHeroCard } from './components/DeploymentHeroCard'
import { DeploymentDeviceCard } from './components/DeploymentDeviceCard'
import { DeploymentConfigurationCard } from './components/DeploymentConfigurationCard'
import { DeploymentLocationCard } from './components/DeploymentLocationCard'
import { DeploymentNotesCard } from './components/DeploymentNotesCard'
import { useGetCaptureMethodsQuery, useGetActivitySensitivityQuery } from '../../redux/api/projectsApi'
import { useExtendedTheme } from '../../theme'

type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetails'>

interface Props {
    deployment: Deployment
}

const DeploymentDetailsScreenComponent: React.FC<Props> = ({ deployment }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const [menuVisible, setMenuVisible] = React.useState(false)
    const theme = useExtendedTheme()
    const { colors } = theme
    const styles = useMemo(() => createStyles(theme), [theme])

    // Queries for lookup data
    const { data: captureMethods } = useGetCaptureMethodsQuery()
    const { data: activitySensitivities } = useGetActivitySensitivityQuery()

    // Status helpers
    const isActive = !deployment.deploymentEnd
    const statusLabel = isActive ? 'Active' : (deployment.deploymentStatusId === 2 ? 'Ended' : 'Failed')

    // Lookup names
    const captureMethodName = useMemo(() => {
        if (!deployment.captureMethodId) return 'N/A'
        const cm = captureMethods?.find(c => c.id === deployment.captureMethodId)
        return cm?.value || cm?.description || `Unknown (ID: ${deployment.captureMethodId})`
    }, [deployment.captureMethodId, captureMethods])

    const sensitivityName = useMemo(() => {
        if (!deployment.activityDetectionSensitivityId) return 'N/A'
        const ads = activitySensitivities?.find(a => a.id === deployment.activityDetectionSensitivityId)
        return ads?.value || ads?.description || `Unknown (ID: ${deployment.activityDetectionSensitivityId})`
    }, [deployment.activityDetectionSensitivityId, activitySensitivities])



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
                    title="End Deployment"
                    leadingIcon="stop"
                />
            </Menu>
        ) : null
    ), [isActive, menuVisible, navigation])

    // Configure header menu
    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: renderHeaderRight,
        })
    }, [navigation, renderHeaderRight])



    if (!deployment) {
        return (
            <WWScreenView>
                <WWText>Deployment not found.</WWText>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable>
            <View style={styles.container}>
                {/* Hero Card - Status & Overview */}
                <DeploymentHeroCard deployment={deployment} isActive={isActive} statusLabel={statusLabel} />

                {/* Device Card */}
                <DeploymentDeviceCard deployment={deployment} />

                {/* Project & Configuration Card */}
                <DeploymentConfigurationCard deployment={deployment} captureMethodName={captureMethodName} sensitivityName={sensitivityName} />

                {/* Location Card */}
                <DeploymentLocationCard deployment={deployment} />

                {/* Notes & Comments Card */}
                <DeploymentNotesCard deployment={deployment} />

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                    <WWButton
                        mode="outlined"
                        icon="map"
                        onPress={() => navigation.navigate('Home')}
                        style={styles.actionButton}
                    >
                        View on Map
                    </WWButton>

                    {isActive && (
                        <WWButton
                            mode="contained"
                            icon="stop"
                            onPress={() => navigation.navigate('EndDeploymentWizard', { mode: 'end_deployment' } as any)}
                            style={[styles.actionButton, styles.endButton]}
                            color={colors.error}
                        >
                            End Deployment
                        </WWButton>
                    )}
                </View>
            </View>
        </WWScreenView>
    )
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        padding: theme.spacing * 1.6, // approx 16
    },

    actionSection: {
        gap: 12,
        marginTop: 8,
        marginBottom: 24,
    },
    actionButton: {
        borderRadius: 8,
    },
    endButton: {
        backgroundColor: theme.colors.error,
    },
})

// Enhance
const enhance = withObservables(['route'], ({ route }: { route: DeploymentDetailsRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const DeploymentDetailsScreen = enhance(DeploymentDetailsScreenComponent)
