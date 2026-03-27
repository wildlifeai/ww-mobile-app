import React, { useCallback, useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Button, Text, SegmentedButtons, useTheme } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBle } from '../../../hooks/useBle'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useMotionDetectionStream } from '../hooks/useMotionDetectionStream'
import { log, logError } from '../../../utils/logger'

interface MotionDetectionSectionProps {
    bleDevice: ExtendedPeripheral | undefined
    isInitializing: boolean
    bleDeviceConnected: boolean
    onShowHelp: (title: string, content: string) => void
}

export const MotionDetectionSection: React.FC<MotionDetectionSectionProps> = ({
    bleDevice,
    isInitializing,
    bleDeviceConnected,
    onShowHelp
}) => {
    const theme = useTheme()
    const { write } = useBle()
    const { setMdSensitivity } = useBleCommands()
    const [sensitivity, setSensitivity] = useState<string>('0')
    const [isSetting, setIsSetting] = useState(false)

    const {
        mdGrid,
        isTesting,
        startTest,
        stopTest,
        mdBlocksCount,
        motionDetected
    } = useMotionDetectionStream({ device: bleDevice, write })

    const handleSensitivityChange = useCallback(async (val: string) => {
        if (!bleDevice) return
        setSensitivity(val)
        setIsSetting(true)
        try {
            await setMdSensitivity(bleDevice, val)
            log(`[MotionDetection] Sensitivity set to ${val}`)
        } catch (error) {
            logError('[MotionDetection] Failed to set sensitivity', error)
        } finally {
            setIsSetting(false)
        }
    }, [bleDevice, setMdSensitivity])

    useEffect(() => {
        if (bleDeviceConnected && !isInitializing) {
            log('[MotionDetectionSection] Auto-starting test on mount')
            startTest()
        }
        return () => {
            log('[MotionDetectionSection] Stopping test on unmount')
            stopTest()
        }
    }, [bleDeviceConnected, isInitializing])

    const renderIcon = useCallback((props: any) => <WWIcon {...props} source="paw" />, [])
    const renderHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Motion Detection Test', 'Adjust sensitivity and start the test to see the 16x16 motion grid live. Motion blocks will light up.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    const disabled = isInitializing || !bleDeviceConnected

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Motion Detection Test"
                left={renderIcon}
                right={renderHelp}
            />
            <Card.Content>
                <WWText variant="bodyMedium" style={styles.label}>Sensitivity</WWText>
                <SegmentedButtons
                    value={sensitivity}
                    onValueChange={handleSensitivityChange}
                    buttons={[
                        { value: '0', label: 'Off', disabled: disabled || isSetting },
                        { value: '1', label: 'Low', disabled: disabled || isSetting },
                        { value: '2', label: 'Med', disabled: disabled || isSetting },
                        { value: '3', label: 'High', disabled: disabled || isSetting }
                    ]}
                    style={styles.segmented}
                />

                <View style={styles.controlsRow}>
                    <WWButton 
                        mode={isTesting ? 'outlined' : 'contained'}
                        onPress={isTesting ? stopTest : startTest}
                        disabled={disabled || (sensitivity === '0' && !isTesting)}
                        icon={isTesting ? "stop-circle-outline" : "play-circle-outline"}
                        style={styles.testButton}
                    >
                        <Text>{isTesting ? 'Stop Test' : 'Start Test'}</Text>
                    </WWButton>
                    
                    {isTesting && (
                        <WWText variant="bodySmall" style={styles.blocksText}>
                            Motion in {mdBlocksCount} blocks
                        </WWText>
                    )}
                </View>

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
                                        {/* 16x15 means 16 columns, 15 rows. Total 240 bits. 
                                            We take pixels from the flattened 16x16 array (256 bits) but only first 240. */}
                                        {Array.from({ length: 16 }).map((_, colIndex) => {
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
                            source={motionDetected ? 'paw' : 'paw-off'} 
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
    label: {
        marginBottom: 8,
    },
    segmented: {
        marginBottom: 16,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    testButton: {
        flex: 1,
    },
    blocksText: {
        marginLeft: 16,
        fontStyle: 'italic',
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
