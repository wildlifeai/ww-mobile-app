import { useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton, RadioButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import ReferenceDataService from '../../services/ReferenceDataService'
import { log, logWarn } from '../../utils/logger'
import { WWText } from '../../components/ui/WWText'
import { WWSelect } from '../../components/ui/WWSelect'
import { FileTransferProgressCard } from '../../components/FileTransferProgressCard'
import { useFirmwareUpdate, FirmwareTarget, HimaxFirmwareSource, firmware83Filename } from './hooks/useFirmwareUpdate'
import Firmware from '../../database/models/Firmware'

const TARGET_TITLES: Record<FirmwareTarget, string> = {
    ble: 'BLE Firmware Update',
    himax: 'AI Processor Firmware Update',
}

const TARGET_DESCRIPTIONS: Record<FirmwareTarget, string> = {
    ble: 'Downloads the latest BLE firmware from the cloud and flashes it via Nordic DFU. The device will reboot into a bootloader, apply the update, then reconnect.',
    himax: 'Flashes the Himax AI processor using MANIFEST/output.img from the SD card. Ensure the correct firmware file is on the SD card before starting.',
}

export const FirmwareUpdateScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const target: FirmwareTarget = route.params?.target || 'himax'
    const restrictToLatest = route.params?.restrictToLatest ?? false
    const device = useAppSelector(state => state.devices[deviceId || ''])
    
    const [himaxSource, setHimaxSource] = useState<HimaxFirmwareSource>('sdcard')

    const {
        progress,
        statusLabel,
        isUpdating,
        isComplete,
        isFailed,
        progressLogs,
        errorMsg,
        downloadState,
        downloadProgress,
        fileTransferProgress,
        phase,
        batteryLevel,
        isBatteryLow,
        previousVersion,
        newVersion,
        latestFirmware,
        isPreflightDone,
        sdCardFiles,
        availableDbFirmwares,
        startUpdate,
        cancelUpdate,
    } = useFirmwareUpdate({ target, device })
    
    useEffect(() => {
        // Force a re-sync of firmware data when entering this screen
        // to ensure we have the latest records from the DB
        ReferenceDataService.syncFirmware()
            .then(() => log('[FW Update Screen] Firmware sync complete'))
            .catch(err => logWarn('[FW Update Screen] Firmware sync failed:', err))
    }, [target])

    const [selectedOptionKey, setSelectedOptionKey] = useState<string>('')

    const firmwareOptions = useMemo(() => {
        if (target !== 'himax') return []

        const options: Array<{
            key: string
            label: string
            type: 'db' | 'sd'
            dbRecord?: Firmware
            filename: string
            existsOnSd: boolean
        }> = []

        const matchedSdFiles = new Set<string>()

        availableDbFirmwares.forEach(fw => {
            const filename = firmware83Filename(fw.version, fw.buildDate)
            const existsOnSd = sdCardFiles.some(f => f.toUpperCase() === filename.toUpperCase())
            if (existsOnSd) {
                matchedSdFiles.add(filename.toUpperCase())
            }

            options.push({
                key: `db-${fw.id}`,
                label: `${fw.name || fw.version} ${existsOnSd ? '(On SD Card)' : '(Download Required)'}`,
                type: 'db',
                dbRecord: fw,
                filename,
                existsOnSd,
            })
        })

        sdCardFiles.forEach(filename => {
            if (!matchedSdFiles.has(filename.toUpperCase())) {
                options.push({
                    key: `sd-${filename}`,
                    label: `${filename} (SD Card Only)`,
                    type: 'sd',
                    filename,
                    existsOnSd: true,
                })
            }
        })

        return options
    }, [availableDbFirmwares, sdCardFiles, target])

    const filteredOptions = useMemo(() => {
        if (restrictToLatest) {
            const latestDbOption = firmwareOptions.find(o => o.type === 'db')
            return latestDbOption ? [latestDbOption] : []
        }
        return firmwareOptions
    }, [firmwareOptions, restrictToLatest])

    const selectOptions = useMemo(() => {
        return filteredOptions.map(o => ({
            label: o.label,
            value: o.key,
        }))
    }, [filteredOptions])

    const selectedOption = useMemo(() => {
        return filteredOptions.find(o => o.key === selectedOptionKey)
    }, [filteredOptions, selectedOptionKey])

    useEffect(() => {
        if (filteredOptions.length > 0) {
            const exists = filteredOptions.some(o => o.key === selectedOptionKey)
            if (!exists) {
                setSelectedOptionKey(filteredOptions[0].key)
            }
        } else {
            setSelectedOptionKey('')
        }
    }, [filteredOptions, selectedOptionKey])

    useEffect(() => {
        if (selectedOption) {
            if (selectedOption.type === 'sd') {
                setHimaxSource('sdcard')
            } else if (selectedOption.type === 'db') {
                if (!selectedOption.existsOnSd) {
                    setHimaxSource('download')
                } else {
                    if (himaxSource !== 'sdcard' && himaxSource !== 'download') {
                        setHimaxSource('sdcard')
                    }
                }
            }
        }
    }, [selectedOption, himaxSource])

    const isDfuMode = !!device?.name?.includes('DfuTarg')

    const title = TARGET_TITLES[target]
    const description = TARGET_DESCRIPTIONS[target]




    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    {title}
                </WWText>

                <WWText style={{ marginBottom: spacing }}>
                    {description}
                </WWText>

                {/* ── Pre-flight Info ── */}
                {!isComplete && (
                    <View style={[styles.card, styles.marginBottom8, { backgroundColor: colors.surfaceVariant }]}>
                        <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                            Pre-flight
                        </WWText>

                        {/* Battery */}
                        <View style={styles.preflightRow}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                Battery
                            </WWText>
                            <WWText variant="bodyMedium" style={{ color: isBatteryLow ? colors.error : colors.onSurfaceVariant }}>
                                {isDfuMode ? 'N/A (DFU)' : (batteryLevel !== null ? `${batteryLevel}%` : '—')}
                                {isBatteryLow ? ' ⚠️ Low' : (batteryLevel !== null && !isDfuMode ? ' ✓' : '')}
                            </WWText>
                        </View>

                        {/* Current version */}
                        <View style={styles.preflightRow}>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                Current Version
                            </WWText>
                            <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                                {isDfuMode ? 'N/A (DFU)' : (previousVersion || (isPreflightDone ? 'Unknown' : '…'))}
                            </WWText>
                        </View>

                        {/* Latest available (BLE only) */}
                        {target === 'ble' && latestFirmware && (
                            <View style={styles.preflightRow}>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    Latest Available
                                </WWText>
                                <WWText variant="bodyMedium" style={{ color: colors.primary, flex: 1, textAlign: 'right' }}>
                                    {latestFirmware.version}
                                </WWText>
                            </View>
                        )}

                        {/* Himax Version Selection Dropdown */}
                        {target === 'himax' && selectOptions.length > 0 && (
                            <View style={[styles.marginTop12, styles.marginBottom8]}>
                                <WWSelect
                                    label="Select Firmware Version"
                                    options={selectOptions}
                                    value={selectedOptionKey}
                                    onChange={setSelectedOptionKey}
                                    disabled={isUpdating}
                                />
                            </View>
                        )}

                        {/* Himax Source Selection */}
                        {target === 'himax' && selectedOption && (
                            <View style={styles.sourceSelection}>
                                <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                                    Firmware Source
                                </WWText>
                                <RadioButton.Group onValueChange={value => setHimaxSource(value as HimaxFirmwareSource)} value={himaxSource}>
                                    <View style={styles.radioRow}>
                                        <RadioButton 
                                            value="sdcard" 
                                            disabled={!selectedOption.existsOnSd} 
                                        />
                                        <WWText 
                                            variant="bodyMedium" 
                                            style={{ color: colors.onSurfaceVariant, flex: 1, opacity: selectedOption.existsOnSd ? 1 : 0.5 }}
                                        >
                                            Use existing MANIFEST/{selectedOption.filename} on SD card
                                        </WWText>
                                    </View>
                                    <View style={styles.radioRow}>
                                        <RadioButton 
                                            value="download" 
                                            disabled={selectedOption.type !== 'db'} 
                                        />
                                        <WWText 
                                            variant="bodyMedium" 
                                            style={{ color: colors.onSurfaceVariant, flex: 1, opacity: selectedOption.type === 'db' ? 1 : 0.5 }}
                                        >
                                            Download {selectedOption.dbRecord ? `"${selectedOption.dbRecord.locationPath}"` : 'firmware'} from DB into MANIFEST/{selectedOption.filename} on SD card
                                        </WWText>
                                    </View>
                                </RadioButton.Group>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Battery Warning ── */}
                {isBatteryLow && !isComplete && (
                    <View style={[styles.warningBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.warningText}>
                            ⚠️ Battery is below 30%. Updating with low battery risks bricking the device. Charge before continuing.
                        </WWText>
                    </View>
                )}

                {/* ── Status Panel ── */}
                <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing * 2 }]}>
                    <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                        Status
                    </WWText>
                    <WWText style={{ color: colors.onSurfaceVariant }}>
                        {statusLabel}
                    </WWText>

                    {/* Dynamic Transfer Progress */}
                    {phase === 'downloading' && (
                        <View style={styles.marginTop12}>
                            <FileTransferProgressCard
                                title="Downloading Firmware"
                                filename={selectedOption?.dbRecord?.locationPath || latestFirmware?.locationPath}
                                isIndeterminate={downloadProgress?.progress === null}
                                progress={downloadProgress?.progress || 0}
                                speedBytesPerSec={downloadProgress?.speedBytesPerSec}
                                estimatedRemainingMs={downloadProgress?.estimatedRemainingMs}
                                statusLabel={downloadState}
                                onCancel={cancelUpdate}
                                isFailed={downloadState === 'failed'}
                                isComplete={downloadState === 'completed'}
                                isPaused={downloadState === 'paused'}
                            />
                        </View>
                    )}

                    {phase === 'transferring' && fileTransferProgress && (
                        <View style={styles.marginTop12}>
                            <FileTransferProgressCard
                                title="Transferring to Device"
                                filename={selectedOption?.filename || 'OUTPUT.IMG'}
                                isIndeterminate={false}
                                progress={fileTransferProgress.percentage / 100}
                                speedBytesPerSec={fileTransferProgress.elapsedMs > 0 ? (fileTransferProgress.bytesSent / fileTransferProgress.elapsedMs) * 1000 : 0} 
                                estimatedRemainingMs={fileTransferProgress.estimatedRemainingMs}
                                bytesTransferred={fileTransferProgress.bytesSent}
                                totalBytes={fileTransferProgress.totalBytes}
                                statusLabel={fileTransferProgress.phase}
                                isFailed={fileTransferProgress.phase === 'failed'}
                                isComplete={fileTransferProgress.phase === 'complete'}
                            />
                        </View>
                    )}

                    {/* Overall Progress bar fallback for non-transfer phases */}
                    {(isUpdating || isComplete) && phase !== 'downloading' && phase !== 'transferring' && (
                        <View style={styles.marginTop12}>
                            <ProgressBar
                                progress={progress}
                                color={isComplete ? '#4CAF50' : colors.primary}
                                style={styles.progressBar}
                            />
                            <WWText variant="bodySmall" style={[styles.progressText, { color: colors.onSurfaceVariant }]}>
                                {Math.round(progress * 100)}%
                            </WWText>
                        </View>
                    )}

                    {/* Spinner */}
                    {isUpdating && !isComplete && (
                        <View style={styles.marginTop12}>
                            <ActivityIndicator animating color={colors.primary} size="large" />
                        </View>
                    )}

                    {/* Live logs */}
                    {progressLogs.length > 0 && (
                        <View style={styles.marginTop12}>
                            {progressLogs.map((line, idx) => (
                                <WWText key={line + idx.toString()} variant="bodySmall" style={[styles.logText, { color: colors.onSurfaceVariant }]}>
                                    → {line}
                                </WWText>
                            ))}
                        </View>
                    )}

                    {/* Error */}
                    {errorMsg && (
                        <WWText style={[styles.marginTop12, { color: colors.error }]}>
                            Error: {errorMsg}
                        </WWText>
                    )}
                </View>

                {/* ── Success Panel ── */}
                {isComplete && !isUpdating && (
                    <View style={[styles.successBox, { marginBottom: spacing * 2 }]}>
                        <View style={styles.successHeader}>
                            <IconButton icon="check-circle" iconColor="#A5D6A7" size={28} style={styles.margin0} />
                            <WWText variant="titleMedium" style={styles.successTitle}>
                                Firmware Updated Successfully
                            </WWText>
                        </View>

                        {previousVersion && (
                            <WWText variant="bodyMedium" style={styles.successText}>
                                Previous: {previousVersion}
                            </WWText>
                        )}
                        {newVersion && (
                            <WWText variant="bodyMedium" style={styles.successTextNoMargin}>
                                New: {newVersion}
                            </WWText>
                        )}
                        {previousVersion && newVersion && previousVersion === newVersion && (
                            <WWText variant="bodySmall" style={styles.warningInfoText}>
                                ⓘ Versions match: the firmware image may be the same build.
                            </WWText>
                        )}
                        {!newVersion && (
                            <WWText variant="bodySmall" style={styles.successSubText}>
                                Device was sent the reset command. The new firmware will be active on the next boot.
                            </WWText>
                        )}
                    </View>
                )}

                {/* ── Action Buttons ── */}
                {!isComplete && !isUpdating && (
                    <Button
                        mode="contained"
                        onPress={() => startUpdate({ 
                            himaxSource, 
                            selectedFirmware: selectedOption?.type === 'db' ? selectedOption.dbRecord : selectedOption?.filename 
                        })}
                        loading={!isPreflightDone}
                        disabled={!isPreflightDone || (target === 'himax' && !selectedOption)}
                    >
                        <WWText>{isFailed ? 'Retry Update' : 'Start Update'}</WWText>
                    </Button>
                )}

                {isComplete && !isUpdating && (
                    <Button
                        mode="contained"
                        onPress={() => navigation.goBack()}
                    >
                        <WWText>Back to Engineer Console</WWText>
                    </Button>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
    },
    card: {
        padding: 16,
        borderRadius: 8,
    },
    preflightRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    warningBanner: {
        backgroundColor: '#BF360C',
        padding: 12,
        borderRadius: 8,
    },
    marginTop12: {
        marginTop: 12,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
    },
    logText: {
        opacity: 0.7,
    },
    successBox: {
        backgroundColor: '#1B5E20',
        padding: 16,
        borderRadius: 8,
    },
    successHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    marginBottom8: {
        marginBottom: 8,
    },
    warningText: {
        color: '#FFF3E0',
    },
    progressText: {
        textAlign: 'right',
        marginTop: 4,
    },
    margin0: {
        margin: 0,
    },
    successTitle: {
        color: '#A5D6A7',
        flex: 1,
    },
    successText: {
        color: '#E8F5E9',
        marginTop: 8,
    },
    successTextNoMargin: {
        color: '#E8F5E9',
    },
    warningInfoText: {
        color: '#FFCC80',
        marginTop: 4,
    },
    successSubText: {
        color: '#E8F5E9',
        marginTop: 4,
    },
    sourceSelection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
})
