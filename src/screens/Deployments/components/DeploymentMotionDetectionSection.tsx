import React, { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Button, Text, useTheme } from 'react-native-paper'

import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBle } from '../../../hooks/useBle'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useMotionDetectionStream } from '../../Devices/hooks/useMotionDetectionStream'
import { logError } from '../../../utils/logger'

interface DeploymentMotionDetectionSectionProps {
    device?: ExtendedPeripheral
    project?: {
        activity_detection_sensitivity_id?: number | null;
        capture_method_id?: number | null;
    }
    onShowHelp: (title: string, content: string) => void
}

export const DeploymentMotionDetectionSection: React.FC<DeploymentMotionDetectionSectionProps> = ({
    device,
    project,
    onShowHelp
}) => {
    const theme = useTheme()
    const { write } = useBle()
    const { setMdSensitivity } = useBleCommands()
    const [isPreparing, setIsPreparing] = useState(false)

    const {
        mdGrid,
        isTesting,
        startTest,
        stopTest,
        mdBlocksCount,
        motionDetected
    } = useMotionDetectionStream({ device, write })

    const handleStartTest = useCallback(async () => {
        // Use activity_detection_sensitivity_id and provide a default
        if (!device || !project?.activity_detection_sensitivity_id) return
        
        setIsPreparing(true)
        try {
            // Apply project's sensitivity first before engaging the test loop
            await setMdSensitivity(device, (project.activity_detection_sensitivity_id ?? 3).toString()) // Changed to activity_detection_sensitivity_id with default
            await startTest()
        } catch (error) {
            logError('[DeploymentMD] Failed to set sensitivity for test', error)
        } finally {
            setIsPreparing(false)
        }
    }, [device, project, setMdSensitivity, startTest])

    const renderIcon = useCallback((props: any) => <WWIcon {...props} source="paw" />, [])
    const renderHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Motion Detection Test', 'Start the test to see the 16x16 motion grid live. Motion blocks will light up if the camera detects movement using your project\'s sensitivity settings.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // Use capture_method_id
    if (!project || project.capture_method_id !== 1) { // Changed to capture_method_id
        return null // Only render for Activity Detection projects
    }

    const disabled = !device || isPreparing

    return (
        <Card style={styles.card}>
            <Card.Title
                title="Motion Detection Test"
                left={renderIcon}
                right={renderHelp}
            />
            <Card.Content>
                <WWText variant="bodySmall" style={styles.sectionDescription}>
                    <Text>Verify when the camera detects motion</Text>
                </WWText>

                <WWButton 
                    mode="outlined"
                    onPress={isTesting ? stopTest : handleStartTest}
                    disabled={disabled}
                    loading={isPreparing}
                >
                    <Text>{isTesting ? 'Stop Test' : (isPreparing ? 'Preparing...' : 'Test Motion Detection')}</Text>
                </WWButton>

                {/* 16x16 Grid Visualizer */}
                {isTesting && (
                    <View style={styles.gridContainer}>
                        <WWText variant="bodySmall" style={styles.blocksText}>
                            Motion in {mdBlocksCount} blocks
                        </WWText>
                        {mdGrid.map((row, rowIndex) => (
                            <View key={`row-${rowIndex}`} style={styles.gridRow}>
                                {row.map((cell, colIndex) => (
                                    <View
                                        key={`cell-${rowIndex}-${colIndex}`}
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
                            color={motionDetected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                        />
                        <WWText 
                            variant="bodySmall" 
                            style={[
                                styles.motionText,
                                motionDetected && styles.motionTextActive,
                                motionDetected && { color: theme.colors.primary }
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
    card: {},
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 16,
    },
    blocksText: {
        opacity: 0.7,
        marginBottom: 8,
        textAlign: 'center',
    },
    gridContainer: {
        marginTop: 16,
        alignItems: 'center',
        padding: 4,
        backgroundColor: '#00000008',
        borderRadius: 8,
    },
    gridRow: {
        flexDirection: 'row',
    },
    gridCell: {
        width: 14,
        height: 14,
        margin: 1,
        borderRadius: 2,
    },
    motionIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: 12,
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
        fontWeight: '600',
    }
})
