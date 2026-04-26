import { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, TextInput, Button, Card, useTheme } from 'react-native-paper'
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

type RouteType = RouteProp<RootStackParamList, 'ModelValidationTestScreen'>

export const ModelValidationTestScreen = () => {
    const route = useRoute<RouteType>()
    const deviceId = route.params?.deviceId
    const theme = useTheme()

    const { } = useBle()
    const connectedDevice = useAppSelector(state => state.devices[deviceId || ''])

    const [projectId, setProjectId] = useState<string>('')
    const [version, setVersion] = useState<string>('')

    const [logs, setLogs] = useState<string[]>([])
    const [isProcessing, setIsProcessing] = useState(false)

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `[${new Date().toISOString().substring(11, 19)}] ${message}`])
    }

    const startValidationFlow = async () => {
        if (!projectId || !version) {
            addLog("Error: Please enter both Project ID and Version.")
            return
        }

        if (!connectedDevice || !connectedDevice.connected) {
            addLog("Error: Device not connected.")
            return
        }

        setIsProcessing(true)
        setLogs([]) // Clear old logs
        
        const pid = parseInt(projectId, 10)
        const ver = parseInt(version, 10)
        const filename = `${pid}V${ver}.TFL`

        addLog(`Starting validation for model: ${filename}`)

        try {
            const session = createBleSession(connectedDevice)

            // Step 1: Check if the file exists on the SD card
            // We use dir command, but since dir output format is unknown and we might not have a reliable regex, 
            // another approach is to just proceed with loadmodel and see if it fails.
            // But let's try to just download it anyway if it's an engineering flow, or we can just query the DB.
            addLog("Looking for model in local WatermelonDB...")
            
            // Query ai_models table to find a model whose storage_path ends with the filename
            const aiModelsCollection = database.get<AiModel>('ai_models')
            const allModels = await aiModelsCollection.query().fetch()
            
            const matchingModel = allModels.find(m => m.storagePath?.toUpperCase().endsWith(filename.toUpperCase()))

            if (!matchingModel) {
                addLog(`❌ Error: Could not find an AI model in the local database that corresponds to ${filename}.`)
                setIsProcessing(false)
                return
            }

            addLog(`Found matching model in DB: ${matchingModel.name} (ID: ${matchingModel.id})`)

            // Step 2: Download from Supabase using AiModelService
            addLog("Downloading model from Supabase...")
            const localUri = await AiModelService.ensureModelDownloaded(matchingModel)
            addLog(`✅ Downloaded to: ${localUri}`)

            // Step 3: Transfer file via BLE
            addLog(`Starting BLE file transfer of ${filename} to device...`)
            const rawBytes = await AiModelService.readModelAsBytes(localUri)
            
            await runFileTransferPipeline(connectedDevice, {
                filename: filename,
                data: rawBytes,
                onProgress: (prog: any) => {
                    if (prog.percentage % 10 === 0) {
                        addLog(`Transferring... ${Math.round(prog.percentage)}% (${prog.bytesSent}/${prog.totalBytes} bytes)`)
                    }
                }
            })

            addLog(`✅ File transfer complete.`)

            // Step 4: Load the model
            await loadModel(pid, ver, session)

        } catch (error) {
            addLog(`❌ Error during validation flow: ${error}`)
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
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>
                        Test Model Validation Flow
                    </Text>
                    <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                        Input the Operational Parameter (OP) numbers for the model to test against. The flow will download from Supabase if missing, transfer via BLE, and load the model.
                    </Text>

                    <TextInput
                        label="Project ID (OP 14)"
                        value={projectId}
                        onChangeText={setProjectId}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        disabled={isProcessing}
                    />

                    <TextInput
                        label="Version (OP 15)"
                        value={version}
                        onChangeText={setVersion}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        disabled={isProcessing}
                    />

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
                        <Text style={{ color: theme.colors.error, marginTop: 8 }}>
                            Device is not connected.
                        </Text>
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.logCard}>
                <Card.Content>
                    <Text variant="titleSmall" style={{ marginBottom: 8 }}>Console Output</Text>
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
    }
})
