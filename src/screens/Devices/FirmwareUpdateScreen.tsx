import { useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, ActivityIndicator, ProgressBar, IconButton, RadioButton, Checkbox } from 'react-native-paper'
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
    himax: 'Updates the camera firmware. The WW500 holds two images - a colour (RP3) and a night-IR (HM0360) camera - and an update flashes both, normally from the MANIFEST folder on the SD card.',
}

// Human labels for the camera variants held in the A/B firmware slots
const VARIANT_META: Record<'RP3' | 'HM0360', { emoji: string; label: string }> = {
    RP3: { emoji: '🎨', label: 'Colour (RP3)' },
    HM0360: { emoji: '🌙', label: 'Night-IR (HM0360)' },
}

/** Decode the camera variant from a website-generated 8.3 image name (R/H prefix). */
const variantFromFilename = (filename: string): 'RP3' | 'HM0360' | null => {
    const c = filename.trim().charAt(0).toUpperCase()
    if (!/\.IMG$/i.test(filename)) return null
    if (c === 'R') return 'RP3'
    if (c === 'H') return 'HM0360'
    return null
}

/** Compact "7 Jul 23:35" from a firmware version string like "WW500_C02 23:35:10 Jul  7 2026". */
const shortBuild = (version?: string | null): string => {
    if (!version) return ''
    const m = version.match(/(\d{2}):(\d{2}):\d{2}\s+([A-Za-z]{3})\s+(\d{1,2})\s+\d{4}/)
    return m ? `${m[4]} ${m[3]} ${m[1]}:${m[2]}` : version
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
        isLikelyExternalPower,
        previousVersion,
        newVersion,
        latestFirmware,
        isPreflightDone,
        sdCardFiles,
        availableDbFirmwares,
        runningVariant,
        pairProgress,
        startUpdate,
        cancelUpdate,
    } = useFirmwareUpdate({ target, device })

    // Low battery blocks flashing unless the user confirms the device is on
    // USB / external power (bench setups read the battery rail as ~0-5%).
    const [externalPowerConfirmed, setExternalPowerConfirmed] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)
    
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
            // The variant letter is part of the on-SD filename (R/H prefix) -
            // matching without it never finds dual-image files.
            const filename = firmware83Filename(fw.version, fw.buildDate, fw.cameraVariant)
            const existsOnSd = sdCardFiles.some(f => f.toUpperCase() === filename.toUpperCase())
            if (existsOnSd) {
                matchedSdFiles.add(filename.toUpperCase())
            }

            const meta = fw.cameraVariant ? VARIANT_META[fw.cameraVariant as 'RP3' | 'HM0360'] : undefined
            const display = meta
                ? `${meta.emoji} ${meta.label} — build ${shortBuild(fw.version)}`
                : `${fw.name || fw.version}`
            options.push({
                key: `db-${fw.id}`,
                label: `${display} ${existsOnSd ? '· on SD card' : '· cloud'}`,
                type: 'db',
                dbRecord: fw,
                filename,
                existsOnSd,
            })
        })

        sdCardFiles.forEach(filename => {
            if (!matchedSdFiles.has(filename.toUpperCase())) {
                const v = variantFromFilename(filename)
                const meta = v ? VARIANT_META[v] : undefined
                options.push({
                    key: `sd-${filename}`,
                    label: meta
                        ? `${meta.emoji} ${meta.label} — ${filename} · on SD card`
                        : `${filename} · on SD card only`,
                    type: 'sd',
                    filename,
                    existsOnSd: true,
                })
            }
        })

        return options
    }, [availableDbFirmwares, sdCardFiles, target])

    // Latest available build per camera variant (availableDbFirmwares is newest-first)
    const latestByVariant = useMemo(() => {
        if (target !== 'himax') return null
        const rp3 = availableDbFirmwares.find(fw => fw.cameraVariant === 'RP3') ?? null
        const hm = availableDbFirmwares.find(fw => fw.cameraVariant === 'HM0360') ?? null
        return (rp3 || hm) ? { rp3, hm } : null
    }, [availableDbFirmwares, target])

    const latestLabel = useMemo(() => {
        if (!latestByVariant) return null
        const { rp3, hm } = latestByVariant
        if (rp3 && hm) {
            const a = shortBuild(rp3.version)
            const b = shortBuild(hm.version)
            return a === b ? `build ${a} (both cameras)` : `🎨 ${a} · 🌙 ${b}`
        }
        const single = rp3 ?? hm
        if (!single) return null
        const meta = VARIANT_META[(single.cameraVariant as 'RP3' | 'HM0360') ?? 'RP3']
        return `${meta.emoji} build ${shortBuild(single.version)} only`
    }, [latestByVariant])

    // Device already on the latest build (for the camera it is running)?
    const deviceUpToDate = useMemo(() => {
        if (!latestByVariant || !previousVersion) return false
        const cur = previousVersion.trim()
        return [latestByVariant.rp3?.version?.trim(), latestByVariant.hm?.version?.trim()].includes(cur)
    }, [latestByVariant, previousVersion])

    // The one-tap pair update needs both camera images: a variant-labelled DB
    // record per camera whose (variant-lettered) file is already on the SD card.
    const pairOnSd = useMemo(() => {
        if (target !== 'himax') return false
        return (['RP3', 'HM0360'] as const).every(v =>
            availableDbFirmwares.some(fw =>
                fw.cameraVariant === v &&
                sdCardFiles.some(f => f.toUpperCase() === firmware83Filename(fw.version, fw.buildDate, v).toUpperCase())
            )
        )
    }, [availableDbFirmwares, sdCardFiles, target])

    // Cloud fallback for the pair update: a variant-labelled DB record per
    // camera (downloaded per pass by the update hook). Preferred source is
    // still the SD card - no download, no BLE transfer, ~2 min total.
    const pairInDb = !!(latestByVariant?.rp3 && latestByVariant?.hm)
    const pairSource: HimaxFirmwareSource | null = pairOnSd ? 'sdcard' : (pairInDb ? 'download' : null)

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

    // Flashing on a genuinely low battery risks a brick; the user can override
    // when the device is on USB / external power (where the reading is meaningless).
    const batteryGateOk = !isBatteryLow || externalPowerConfirmed

    const title = TARGET_TITLES[target]
    const description = TARGET_DESCRIPTIONS[target]




    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>

                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    {title}
                </WWText>

                {/* The himax flow explains itself in the action card below - a
                    standing paragraph here just pushed the button off-screen. */}
                {target === 'ble' && (
                    <WWText style={{ marginBottom: spacing }}>
                        {description}
                    </WWText>
                )}

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
                            <WWText
                                variant="bodyMedium"
                                style={{ color: isLikelyExternalPower ? colors.onSurfaceVariant : (isBatteryLow ? colors.error : colors.onSurfaceVariant) }}
                            >
                                {isDfuMode
                                    ? 'N/A (DFU)'
                                    : isLikelyExternalPower
                                        ? `${batteryLevel}% ⚡ external power?`
                                        : (batteryLevel !== null ? `${batteryLevel}%` : '—')}
                                {!isLikelyExternalPower && isBatteryLow ? ' ⚠️ Low' : (!isLikelyExternalPower && batteryLevel !== null && !isDfuMode ? ' ✓' : '')}
                            </WWText>
                        </View>

                        {/* Current camera (himax) */}
                        {target === 'himax' && runningVariant && !isDfuMode && (
                            <View style={styles.preflightRow}>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    Current Camera
                                </WWText>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    {VARIANT_META[runningVariant].emoji} {VARIANT_META[runningVariant].label}
                                </WWText>
                            </View>
                        )}

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

                        {/* Latest available (himax: the camera pair) */}
                        {target === 'himax' && latestLabel && !isDfuMode && (
                            <View style={styles.preflightRow}>
                                <WWText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                                    Latest Available
                                </WWText>
                                <WWText
                                    variant="bodyMedium"
                                    style={{ color: deviceUpToDate ? colors.onSurfaceVariant : colors.primary, flex: 1, textAlign: 'right' }}
                                >
                                    {latestLabel}{deviceUpToDate ? ' ✓ up to date' : ''}
                                </WWText>
                            </View>
                        )}

                    </View>
                )}

                {/* ── Battery Warning + external-power override ── */}
                {isBatteryLow && !isComplete && (
                    <View style={[styles.warningBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.warningText}>
                            {isLikelyExternalPower
                                ? `⚡ Battery reads ${batteryLevel}% — this usually means the device is running from USB / a bench supply (no battery detected). If it IS battery-powered, charge before updating.`
                                : '⚠️ Battery is below 30%. Updating with low battery risks bricking the device. Charge before continuing.'}
                        </WWText>
                        <View style={styles.overrideRow}>
                            <Checkbox.Android
                                status={externalPowerConfirmed ? 'checked' : 'unchecked'}
                                onPress={() => setExternalPowerConfirmed(v => !v)}
                                color="#FFF3E0"
                                uncheckedColor="#FFF3E0"
                            />
                            <WWText style={[styles.warningText, { flex: 1 }]} onPress={() => setExternalPowerConfirmed(v => !v)}>
                                The device is on USB / external power — allow the update
                            </WWText>
                        </View>
                    </View>
                )}

                {/* ── Primary action: update both cameras ──
                    Source is chosen automatically: SD-card images when present
                    (no transfer, ~2 min), else downloaded from the cloud and
                    sent over BLE (~10 min). */}
                {target === 'himax' && !restrictToLatest && !isComplete && !isUpdating && (
                    <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                        <WWText variant="titleSmall" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                            Update both cameras{latestLabel ? ` — ${latestLabel}` : ''}
                        </WWText>
                        <WWText variant="bodyMedium" style={[styles.marginBottom8, { color: colors.onSurfaceVariant }]}>
                            {pairSource === 'sdcard'
                                ? `Flashes the ${VARIANT_META.RP3.emoji} colour and ${VARIANT_META.HM0360.emoji} night-IR images from the SD card in two passes (about 2 minutes).`
                                : pairSource === 'download'
                                    ? `Downloads the ${VARIANT_META.RP3.emoji} colour and ${VARIANT_META.HM0360.emoji} night-IR images from the cloud and sends them over Bluetooth (about 10 minutes — keep the phone nearby).`
                                    : 'Flashes the colour and night-IR camera images in two passes.'}
                            {' '}The device finishes on the camera it is using now.
                        </WWText>
                        {!pairSource && isPreflightDone && (
                            <WWText variant="bodySmall" style={[styles.marginBottom8, { color: colors.error }]}>
                                No firmware images available — sync the app to fetch the catalogue, or prepare the
                                SD card from the website and reinsert it.
                            </WWText>
                        )}
                        <Button
                            mode="contained"
                            onPress={() => pairSource && startUpdate({ himaxSource: pairSource })}
                            loading={!isPreflightDone}
                            disabled={!isPreflightDone || !pairSource || !batteryGateOk}
                        >
                            <WWText>
                                {pairSource === 'download' ? 'Update both cameras (cloud)' : 'Update both cameras'}
                            </WWText>
                        </Button>
                        {!batteryGateOk && (
                            <WWText variant="bodySmall" style={[styles.marginTop12, { color: colors.error }]}>
                                Blocked by low battery — tick the external-power box above if bench-powered.
                            </WWText>
                        )}
                    </View>
                )}

                {/* ── Advanced: flash a specific image / choose the source ──
                    Collapsed to a single text row by default; the card only
                    appears when expanded (or when Flow 1 restricts to latest). */}
                {target === 'himax' && !isComplete && !isUpdating && !restrictToLatest && !showAdvanced && (
                    <Button
                        mode="text"
                        compact
                        onPress={() => setShowAdvanced(true)}
                        style={{ marginBottom: spacing }}
                    >
                        ▸ Advanced: flash a specific image
                    </Button>
                )}
                {target === 'himax' && !isComplete && !isUpdating && (showAdvanced || restrictToLatest) && (
                    <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                        {!restrictToLatest && (
                            <Button mode="text" compact onPress={() => setShowAdvanced(false)}>
                                ▾ Hide advanced
                            </Button>
                        )}

                        {selectOptions.length > 0 ? (
                            <View style={styles.marginTop12}>
                                <WWSelect
                                    label="Firmware build"
                                    options={selectOptions}
                                    value={selectedOptionKey}
                                    onChange={setSelectedOptionKey}
                                    disabled={isUpdating}
                                />
                            </View>
                        ) : (
                            <WWText variant="bodySmall" style={[styles.marginTop12, { color: colors.onSurfaceVariant }]}>
                                No firmware builds found — sync the app or insert a prepared SD card.
                            </WWText>
                        )}

                        {selectedOption && (
                            <View style={styles.sourceSelection}>
                                <RadioButton.Group onValueChange={value => setHimaxSource(value as HimaxFirmwareSource)} value={himaxSource}>
                                    <View style={styles.radioRow}>
                                        <RadioButton.Android
                                            value="sdcard"
                                            disabled={!selectedOption.existsOnSd}
                                        />
                                        <WWText
                                            variant="bodyMedium"
                                            style={{ color: colors.onSurfaceVariant, flex: 1, opacity: selectedOption.existsOnSd ? 1 : 0.5 }}
                                        >
                                            Use MANIFEST/{selectedOption.filename} already on the SD card
                                        </WWText>
                                    </View>
                                    <View style={styles.radioRow}>
                                        <RadioButton.Android
                                            value="download"
                                            disabled={!selectedOption.dbRecord}
                                        />
                                        <WWText
                                            variant="bodyMedium"
                                            style={{ color: colors.onSurfaceVariant, flex: 1, opacity: selectedOption.dbRecord ? 1 : 0.5 }}
                                        >
                                            Download from the cloud, then send over Bluetooth into MANIFEST/{selectedOption.filename}
                                        </WWText>
                                    </View>
                                </RadioButton.Group>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Status Panel — only once an update is underway ── */}
                {(isUpdating || isComplete || isFailed || progressLogs.length > 0) && (
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

                    {/* Keyed to the transfer's own lifecycle, NOT the update phase
                        machine: a device 'Wake' line used to leapfrog the phase past
                        'transferring' (forward-only ordering), hiding this card for
                        the whole multi-minute transfer. It also reappears for the
                        second image of a dual-camera update, where the phase machine
                        is already beyond 'transferring' for good. The hook clears
                        the state when a transfer finishes, so presence == in flight
                        (or failed, which the card renders). */}
                    {fileTransferProgress ? (
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
                    ) : null}

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

                    {/* Partial pair: one image landed, the other did not */}
                    {isFailed && pairProgress && pairProgress.done > 0 && pairProgress.done < pairProgress.total && (
                        <WWText style={[styles.marginTop12, { color: '#FFCC80' }]}>
                            ⚠️ {pairProgress.done} of {pairProgress.total} camera images updated — the device is usable
                            but the cameras are on different builds. Press Retry to finish the pair.
                        </WWText>
                    )}
                </View>
                )}

                {/* ── Success Panel ── */}
                {isComplete && !isUpdating && (
                    <View style={[styles.successBox, { marginBottom: spacing * 2 }]}>
                        <View style={styles.successHeader}>
                            <IconButton icon="check-circle" iconColor="#A5D6A7" size={28} style={styles.margin0} />
                            <WWText variant="titleMedium" style={styles.successTitle}>
                                {target === 'himax' && pairProgress?.total === 2 && pairProgress.done === 2
                                    ? 'Both Cameras Updated'
                                    : 'Firmware Updated Successfully'}
                            </WWText>
                        </View>

                        {target === 'himax' && runningVariant && (
                            <WWText variant="bodyMedium" style={styles.successText}>
                                Now running: {VARIANT_META[runningVariant].emoji} {VARIANT_META[runningVariant].label}
                            </WWText>
                        )}

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

                {/* ── Action Buttons ──
                    BLE: the single Start button.
                    Himax: shown for the advanced single-image flow (or restrictToLatest),
                    and after a failure so Retry is always reachable. The primary
                    pair flow has its own button above. */}
                {!isComplete && !isUpdating && (target === 'ble' || showAdvanced || restrictToLatest || isFailed) && (
                    <Button
                        mode="contained"
                        onPress={() => startUpdate({
                            himaxSource,
                            selectedFirmware: selectedOption?.type === 'db' ? selectedOption.dbRecord : selectedOption?.filename
                        })}
                        loading={!isPreflightDone}
                        disabled={!isPreflightDone || !batteryGateOk
                            || (target === 'himax' && (!selectedOption
                                || (himaxSource === 'download' && !selectedOption.dbRecord)
                                || (himaxSource === 'sdcard' && !selectedOption.existsOnSd)))}
                    >
                        <WWText>{isFailed ? 'Retry Update' : (target === 'himax' ? 'Flash Selected Build' : 'Start Update')}</WWText>
                    </Button>
                )}

                {isComplete && !isUpdating && (
                    <Button
                        mode="contained"
                        onPress={() => navigation.goBack()}
                    >
                        <WWText>Back to Firmware Status</WWText>
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
    overrideRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
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
