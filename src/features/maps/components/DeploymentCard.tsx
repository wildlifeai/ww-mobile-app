import React, { useEffect } from 'react'
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { useExtendedTheme } from '../../../theme'
import type Deployment from '../../../database/models/Deployment'

interface Props {
    deployment: Deployment | undefined | null
    isVisible: boolean
    onClose: () => void
    onPress: () => void
}



export const DeploymentCard: React.FC<Props> = ({ deployment, isVisible, onClose, onPress }) => {
    const { colors } = useExtendedTheme()
    const slideAnim = useSharedValue(300) // Start off-screen (down)

    useEffect(() => {
        if (isVisible && deployment) {
            // Slide up
            slideAnim.value = withSpring(0, {
                damping: 8,
                stiffness: 40
            })
        } else {
            // Slide down
            slideAnim.value = withTiming(300, {
                duration: 200
            })
        }
    }, [isVisible, deployment, slideAnim])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideAnim.value }]
    }))

    if (!isVisible || !deployment) return null

    // Status helper (duplicated from MapScreen, could be shared util)
    const getStatusInfo = (statusId?: number | null) => {
        switch (statusId) {
            case 1: return { label: 'Active', color: '#4CAF50', icon: 'check-circle' as const }
            case 2: return { label: 'Ended', color: '#616161', icon: 'stop-circle' as const }
            case 3: return { label: 'Failed', color: '#F44336', icon: 'alert-circle' as const }
            default: return { label: 'Unknown', color: '#757575', icon: 'help-circle' as const }
        }
    }

    const statusObj = getStatusInfo(deployment?.deploymentStatusId)

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface
                },
                animatedStyle
            ]}
        >
            {/* Header / Stripe */}
            <View style={[styles.stripe, { backgroundColor: statusObj.color }]} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: colors.onSurface }]}>
                            {deployment?.name || 'Unnamed Deployment'}
                        </Text>
                        <View style={styles.statusRow}>
                            <MaterialCommunityIcons name={statusObj.icon} size={14} color={statusObj.color} />
                            <Text style={[styles.statusText, { color: statusObj.color }]}>
                                {statusObj.label}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <MaterialCommunityIcons name="close" size={24} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                </View>

                {deployment?.locationName && (
                    <View style={styles.locationRow}>
                        <MaterialCommunityIcons name="map-marker" size={16} color={colors.onSurfaceVariant} />
                        <Text style={[styles.locationText, { color: colors.onSurfaceVariant }]}>
                            {deployment.locationName}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={onPress}
                >
                    <Text style={[styles.buttonText, { color: colors.onPrimary }]}>View Details</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color={colors.onPrimary} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90, // Above FABs
        left: 16,
        right: 16,
        borderRadius: 16,
        boxShadow: "0px 3px 4.65px rgba(0, 0, 0, 0.27)",
        overflow: 'hidden', // For stripe
    },
    stripe: {
        height: 6,
        width: '100%',
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 4,
    },
    locationText: {
        fontSize: 14,
        marginLeft: 6,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    iconSmall: {
        width: 14,
        height: 14,
    },
    iconMedium: {
        width: 16,
        height: 16,
    },
    iconLarge: {
        width: 24,
        height: 24,
    }
})
