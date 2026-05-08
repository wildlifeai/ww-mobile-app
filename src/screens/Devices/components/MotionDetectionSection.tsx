import React, { useCallback, useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, SegmentedButtons, useTheme } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { useMotionDetectionStream } from '../hooks/useMotionDetectionStream'
import { log, logError } from '../../../utils/logger'

interface MotionDetectionSectionProps {
    bleDevice: ExtendedPeripheral | undefined
    isInitializing: boolean
    bleDeviceConnected: boolean
    onShowHelp?: (title: string, content: string) => void
}

export const MotionDetectionSection: React.FC<MotionDetectionSectionProps> = ({
    bleDevice,
    isInitializing,
    bleDeviceConnected,
}) => {
    const theme = useTheme()
    const [sensitivity, setSensitivity] = useState<string>('1')
    const [isSetting, setIsSetting] = useState(false)

    const {
        mdGrid,
        isTesting,
        startTest,
        stopTest,
        mdBlocksCount,
        motionDetected
    } = useMotionDetectionStream({ device: bleDevice })

    const handleSensitivityChange = useCallback(async (val: string) => {
        if (!bleDevice) return
        setSensitivity(val)
        setIsSetting(true)
        try {
            const session = createBleSession(bleDevice)
            await session.execute(() => commandRegistry.md(parseInt(val, 10)))
            log(`[MotionDetection] Sensitivity set to ${val}`)
        } catch (error) {
            logError('[MotionDetection] Failed to set sensitivity', error)
        } finally {
            setIsSetting(false)
        }
    }, [bleDevice])

    useEffect(() => {
        if (bleDeviceConnected && !isInitializing) {
            log('[MotionDetectionSection] Auto-starting test on mount')
            startTest()
        }
        return () => {
            log('[MotionDetectionSection] Stopping test on unmount')
            stopTest()
        }
    }, [bleDeviceConnected, isInitializing, startTest, stopTest])

    const disabled = isInitializing || !bleDeviceConnected

    return (
        <Card style={styles.card}>
            <Card.Content>
                {/* Start / Stop buttons */}
                <View style={styles.buttonsRow}>
                    <WWButton
                        mode="contained"
                        onPress={startTest}
                        disabled={disabled || isTesting}
                        icon="play-circle-outline"
                        style={styles.actionButton}
                    >
                        <Text>Start Test</Text>
                    </WWButton>

                    <WWButton
                        mode="outlined"
                        onPress={stopTest}
                        disabled={disabled || !isTesting}
                        icon="stop-circle-outline"
                        style={styles.actionButton}
                    >
                        <Text>Stop Test</Text>
                    </WWButton>
                </View>

                {/* Sensitivity level */}
                <WWText variant="bodyMedium" style={styles.label}>Sensitivity</WWText>
                <SegmentedButtons
                    value={sensitivity}
                    onValueChange={handleSensitivityChange}
                    buttons={[
                        { value: '1', label: 'Low', disabled: disabled || isSetting },
                        { value: '2', label: 'Med', disabled: disabled || isSetting },
                        { value: '3', label: 'High', disabled: disabled || isSetting }
                    ]}
                    style={styles.segmented}
                />

                {isTesting && (
                    <WWText variant="bodySmall" style={styles.blocksText}>
                        Motion in {mdBlocksCount} blocks
                    </WWText>
                )}

                {/* Grid Visualizers */}
                {isTesting && (
                    <View style={styles.dualGridContainer}>
                        <View style={styles.gridWrapper}>
                            <WWText variant="labelSmall" style={styles.gridLabel}>16x16 Grid</WWText>
                            <View style={styles.gridContainer}>
                                {mdGrid.map((row, rowIndex) => (
                                    <View key={`row-16-${rowIndex}`} style={styles.gridRow}>
                                        {row.map((cell, colIndex) => (
                                            <View
                                                key={`cell-16-${rowIndex}-${colIndex}`}
                                                style={[
                                                    styles.gridCell,
                                                    {
                                                        backgroundColor: cell 
                                                            ? theme.colors.primary 
                                                            : theme.colors.surfaceVariant
                                                    }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.gridWrapper}>
                            <WWText variant="labelSmall" style={styles.gridLabel}>16x15 Grid</WWText>
                            <View style={styles.gridContainer}>
                                {Array.from({ length: 15 }).map((_, rowIndex) => (
                                    <View key={`row-15-${rowIndex}`} style={styles.gridRow}>
                                        {Array.from({ length: 16 }).map((__, colIndex) => {
                                            const flatIndex = rowIndex * 16 + colIndex
                                            const cell = mdGrid.flat()[flatIndex]
                                            return (
                                                <View
                                                    key={`cell-15-${rowIndex}-${colIndex}`}
                                                    style={[
                                                        styles.gridCell,
                                                        {
                                                            backgroundColor: cell 
                                                                ? theme.colors.tertiary
                                                                : theme.colors.surfaceVariant
                                                        }
                                                    ]}
                                                />
                                            )
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Motion threshold indicator */}
                {isTesting && (
                    <View style={[
                        styles.motionIndicator,
                        motionDetected && styles.motionIndicatorActive
                    ]}>
                        <WWIcon 
                            source={motionDetected ? 'motion-sensor' : 'motion-sensor-off'} 
                            size={18}
                            color={motionDetected ? '#4CAF50' : theme.colors.onSurfaceVariant}
                        />
                        <WWText 
                            variant="bodySmall" 
                            style={[
                                styles.motionText,
                                motionDetected && styles.motionTextActive
                            ]}
                        >
                            {motionDetected ? 'Motion threshold exceeded!' : 'No motion'}
                        </WWText>
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
    },
    label: {
        marginBottom: 8,
    },
    segmented: {
        marginBottom: 16,
    },
    blocksText: {
        fontStyle: 'italic',
        marginBottom: 12,
        textAlign: 'center',
    },
    dualGridContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingVertical: 8,
        backgroundColor: '#00000010',
        borderRadius: 8,
    },
    gridWrapper: {
        alignItems: 'center',
    },
    gridLabel: {
        marginBottom: 4,
        opacity: 0.7,
        fontWeight: '700',
    },
    gridContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    gridRow: {
        flexDirection: 'row',
    },
    gridCell: {
        width: 10,
        height: 10,
        margin: 0.5,
        borderRadius: 1,
    },
    motionIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: 8,
        borderRadius: 6,
        backgroundColor: '#00000008',
    },
    motionIndicatorActive: {
        backgroundColor: '#4CAF5018',
    },
    motionText: {
        marginLeft: 6,
        color: '#888',
    },
    motionTextActive: {
        color: '#4CAF50',
        fontWeight: '600',
    }
})

