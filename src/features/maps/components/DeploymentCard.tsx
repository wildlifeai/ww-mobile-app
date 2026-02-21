import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native'
import { Image } from 'expo-image'
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
    const slideAnim = useRef(new Animated.Value(300)).current // Start off-screen (down)

    useEffect(() => {
        if (isVisible && deployment) {
            // Slide up
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                friction: 8,
                tension: 40
            }).start()
        } else {
            // Slide down
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 200,
                useNativeDriver: true
            }).start()
        }
    }, [isVisible, deployment, slideAnim])

    if (!isVisible || !deployment) return null

    // Status helper (duplicated from MapScreen, could be shared util)
    const getStatusInfo = (statusId?: number | null) => {
        switch (statusId) {
            case 1: return { label: 'Active', color: '#4CAF50', icon: 'sf:checkmark.circle.fill' }
            case 2: return { label: 'Ended', color: '#616161', icon: 'sf:stop.circle.fill' }
            case 3: return { label: 'Failed', color: '#F44336', icon: 'sf:exclamationmark.circle.fill' }
            default: return { label: 'Unknown', color: '#757575', icon: 'sf:questionmark.circle.fill' }
        }
    }

    const statusObj = getStatusInfo(deployment?.deploymentStatusId)

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface,
                    transform: [{ translateY: slideAnim }]
                }
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
                            <Image source={statusObj.icon} style={{ width: 14, height: 14, tintColor: statusObj.color }} />
                            <Text style={[styles.statusText, { color: statusObj.color }]}>
                                {statusObj.label}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Image source="sf:xmark" style={{ width: 24, height: 24, tintColor: colors.onSurfaceVariant }} />
                    </TouchableOpacity>
                </View>

                {deployment?.locationName && (
                    <View style={styles.locationRow}>
                        <Image source="sf:mappin.and.ellipse" style={{ width: 16, height: 16, tintColor: colors.onSurfaceVariant }} />
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
                    <Image source="sf:arrow.right" style={{ width: 16, height: 16, tintColor: colors.onPrimary }} />
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
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
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
    }
})
