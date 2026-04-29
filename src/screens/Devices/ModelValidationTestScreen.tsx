import { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Button, Card, useTheme } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../../navigation/types'

import { useBle } from '../../hooks/useBle'
import { useAppSelector } from '../../redux'
import { createBleSession } from '../../ble/session/createBleSession'
import { commandRegistry } from '../../ble/protocol/commandRegistry'
import { runFileTransferPipeline } from '../../ble/protocol/fileTransfer'
import AiModelService from '../../services/AiModelService'
import database from '../../database'
import AiModel from '../../database/models/AiModel'
import { WWSelect, Option } from '../../components/ui/WWSelect'
import { useEffect } from 'react'

type RouteType = RouteProp<RootStackParamList, 'ModelValidationTestScreen'>

export const ModelValidationTestScreen = () => {
    const route = useRoute<RouteType>()
    const deviceId = route.params?.deviceId
    const theme = useTheme()

    const { } = useBle()
    const connectedDevice = useAppSelector(state => state.devices[deviceId || ''])

    const [models, setModels] = useState<AiModel[]>([])
    const [selectedModelId, setSelectedModelId] = useState<string>('')
    const [logs, setLogs] = useState<string[]>([])
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const aiModelsCollection = database.get<AiModel>('ai_models')
                const allModels = await aiModelsCollection.query().fetch()
                setModels(allModels)
            } catch (err) {
                addLog(`Error fetching models: ${err}`)
            }
        }
        fetchModels()
    }, [])

    const modelOptions: Option[] = models.map(m => ({
        label: `${m.name} (${m.version})`,
        value: m.id
    }))

    const selectedModel = models.find(m => m.id === selectedModelId)

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toISOString().substring(11, 19)}] ${message}`])
    }

    const startValidationFlow = async () => {
        if (!selectedModel) {
            addLog("Error: Please select a model.")
            return
        }

        if (!connectedDevice || !connectedDevice.connected) {
            addLog("Error: Device not connected.")
            return
        }

        setIsProcessing(true)
        setLogs([]) // Clear old logs
        
        const pid = selectedModel.firmwareModelId || 0
        const ver = selectedModel.versionNumber || 0
        const tflFilename = `${pid}V${ver}.TFL`
        const labelsFilename = `${pid}V${ver}.TXT`

        addLog(`🚀 Starting validation for model: ${selectedModel.name}`)
        addLog(`   Metadata: OP14=${pid}, OP15=${ver}`)

        try {
            const session = createBleSession(connectedDevice)
            
            // Wake up AI processor
            addLog("Waking AI processor...")
            await session.execute(() => commandRegistry.aiver())

            // Step 1: Check if the files exist on the SD card
            addLog("Step 1: Checking SD card for existing files...")
            const files = await session.execute(commandRegistry.dir) as string[]
            const hasTfl = files.some(f => f.toUpperCase().includes(tflFilename.toUpperCase()))
            const hasLabels = files.some(f => f.toUpperCase().includes(labelsFilename.toUpperCase()))

            if (hasTfl && hasLabels) {
                addLog(`✅ Files already exist on SD card. Skipping transfer.`)
            } else {
                if (!hasTfl) addLog(`📥 ${tflFilename} missing on SD.`)
                if (!hasLabels) addLog(`📥 ${labelsFilename} missing on SD.`)

                // Step 2: Download from Supabase
                addLog("Step 2: Ensuring model files are downloaded...")
                const localFiles = await AiModelService.ensureFilesDownloaded(selectedModel)
                addLog(`✅ Local model path: ${localFiles.modelUri}`)
                if (localFiles.labelsUri) addLog(`✅ Local labels path: ${localFiles.labelsUri}`)

                // Step 3: Transfer files via BLE
                addLog(`Step 3: Transferring files to device...`)
                
                // Transfer TFL
                if (!hasTfl) {
                    addLog(`Sending ${tflFilename}...`)
                    const tflBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
                    await runFileTransferPipeline(connectedDevice, {
                        filename: tflFilename,
                        data: tflBytes,
                        onProgress: (prog) => {
                            if (prog.percentage % 20 === 0) {
                                addLog(`  ${tflFilename}: ${prog.percentage}%`)
                            }
                        }
                    })
                    addLog(`✅ ${tflFilename} transferred.`)
                }

                // Transfer Labels
                if (!hasLabels && localFiles.labelsUri) {
                    addLog(`Sending ${labelsFilename}...`)
                    const labelsBytes = await AiModelService.readModelAsBytes(localFiles.labelsUri)
                    await runFileTransferPipeline(connectedDevice, {
                        filename: labelsFilename,
                        data: labelsBytes,
                        onProgress: (prog) => {
                            if (prog.percentage % 20 === 0) {
                                addLog(`  ${labelsFilename}: ${prog.percentage}%`)
                            }
                        }
                    })
                    addLog(`✅ ${labelsFilename} transferred.`)
                }
            }

            // Step 4: Verify files exist on SD card
            addLog("Step 4: Verifying files on SD card...")
            const finalFiles = await session.execute(commandRegistry.dir) as string[]
            const verifiedTfl = finalFiles.some(f => f.toUpperCase().includes(tflFilename.toUpperCase()))
            const verifiedLabels = finalFiles.some(f => f.toUpperCase().includes(labelsFilename.toUpperCase()))
            
            if (verifiedTfl) {
                addLog(`✅ VERIFIED: ${tflFilename} is present on SD card.`)
                if (verifiedLabels) addLog(`✅ VERIFIED: ${labelsFilename} is present on SD card.`)
                
                // Final load check
                addLog("Final Step: Attempting to load model...")
                await loadModel(pid, ver, session)
            } else {
                addLog(`❌ FAILED: ${tflFilename} not found on SD card after transfer.`)
            }

        } catch (error) {
            addLog(`❌ Error: ${error}`)
        } finally {
            setIsProcessing(false)
        }
    }

    const loadModel = async (pid: number, ver: number, session: any) => {
        addLog(`Instructing device to load model ${pid} Version ${ver}...`)
        try {
            await session.execute(() => commandRegistry.loadmodel(pid, ver))
            addLog(`✅ Model loaded successfully!`)
        } catch (e: any) {
            addLog(`⚠️ Unexpected response or error when loading model: ${e}`)
        }
    }

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Text variant="titleMedium" style={styles.title}>
                        Test Model Validation Flow
                    </Text>
                    <Text variant="bodyMedium" style={styles.description}>
                        Input the Operational Parameter (OP) numbers for the model to test against. The flow will download from Supabase if missing, transfer via BLE, and load the model.
                    </Text>

                    <WWSelect
                        label="Select AI Model"
                        options={modelOptions}
                        value={selectedModelId}
                        onChange={setSelectedModelId}
                        disabled={isProcessing}
                        style={styles.input}
                    />

                    {selectedModel && (
                        <View style={styles.metadataContainer}>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>OP 14 (ID):</Text>
                                <Text style={[styles.metadataValue, !selectedModel.firmwareModelId && styles.metadataMissing]}>
                                    {selectedModel.firmwareModelId ?? 'Not synced'}
                                </Text>
                            </View>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>OP 15 (Ver):</Text>
                                <Text style={[styles.metadataValue, !selectedModel.versionNumber && styles.metadataMissing]}>
                                    {selectedModel.versionNumber ?? 'Not synced'}
                                </Text>
                            </View>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>Filename:</Text>
                                <Text style={styles.metadataValue}>
                                    {(selectedModel.firmwareModelId ?? '?')}V{(selectedModel.versionNumber ?? '?')}.TFL
                                </Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>Model Path:</Text>
                                <Text style={[styles.metadataPathValue, !selectedModel.modelPath && styles.metadataMissing]} numberOfLines={2}>
                                    {selectedModel.modelPath ?? '⚠️ Not set'}
                                </Text>
                            </View>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>Labels Path:</Text>
                                <Text style={[styles.metadataPathValue, !selectedModel.labelsPath && styles.metadataMissing]} numberOfLines={2}>
                                    {selectedModel.labelsPath ?? '⚠️ Not set'}
                                </Text>
                            </View>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>Size:</Text>
                                <Text style={styles.metadataValue}>
                                    {selectedModel.fileSizeBytes ? `${(selectedModel.fileSizeBytes / 1024).toFixed(1)} KB` : 'Unknown'}
                                </Text>
                            </View>
                            <View style={styles.chipRow}>
                                <Text style={styles.metadataLabel}>Status:</Text>
                                <Text style={styles.metadataValue}>
                                    {selectedModel.status ?? 'Unknown'}
                                </Text>
                            </View>
                        </View>
                    )}

                    <Button 
                        mode="contained" 
                        onPress={startValidationFlow} 
                        loading={isProcessing}
                        disabled={isProcessing || !connectedDevice?.connected}
                        style={styles.button}
                    >
                        {isProcessing ? "Processing..." : "Validate & Load Model"}
                    </Button>

                    {!connectedDevice?.connected && (
                         
                        <Text style={[styles.errorText, { color: theme.colors.error }]}>
                            Device is not connected.
                        </Text>
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.logCard}>
                <Card.Content>
                    <Text variant="titleSmall" style={styles.consoleTitle}>Console Output</Text>
                    <View style={styles.logContainer}>
                        {logs.map((log, index) => (
                            <Text key={index} style={styles.logText}>{log}</Text>
                        ))}
                        {logs.length === 0 && <Text style={styles.logText}>Ready...</Text>}
                    </View>
                </Card.Content>
            </Card>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    card: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 12,
    },
    button: {
        marginTop: 8,
    },
    logCard: {
        marginBottom: 32,
    },
    title: {
        marginBottom: 16,
    },
    description: {
        marginBottom: 16,
    },
    errorText: {
        marginTop: 8,
    },
    consoleTitle: {
        marginBottom: 8,
    },
    logContainer: {
        backgroundColor: '#1e1e1e',
        padding: 12,
        borderRadius: 4,
        minHeight: 200,
    },
    logText: {
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: 12,
        marginBottom: 4,
    },
    metadataContainer: {
        backgroundColor: '#2a2a2a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    chipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    metadataLabel: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#aaa',
    },
    metadataValue: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#e0e0e0',
    },
    metadataPathValue: {
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#e0e0e0',
        maxWidth: '65%',
        textAlign: 'right',
    },
    metadataMissing: {
        color: '#ff9800',
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginVertical: 8,
    },
})
