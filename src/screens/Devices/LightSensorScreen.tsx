import { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Surface, Divider, Button, ActivityIndicator, Switch } from 'react-native-paper'
import { useRoute } from '@react-navigation/native'

import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { WWText } from '../../components/ui/WWText'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { DeviceHealthBanner } from '../../components/DeviceHealthBanner'
import { useDeviceSelfTest } from '../../hooks/useDeviceSelfTest'
import { useLightSensor } from '../../hooks/useLightSensor'

const NumericInput = ({ label, value, onChange, min, max, disabled }: {
    label: string; value: number; onChange: (v: number) => void; min: number; max: number; disabled?: boolean
}) => {
    const { spacing } = useExtendedTheme()
    const [localValue, setLocalValue] = useState(() => value.toString())
    const [prevValue, setPrevValue] = useState(value)
    if (value !== prevValue) {
        setPrevValue(value)
        setLocalValue(value.toString())
    }
    return (
        <View style={{ marginBottom: spacing }}>
            <WWTextInput
                label={label}
                value={localValue}
                keyboardType="numeric"
                disabled={disabled}
                onChange={(t: string) => setLocalValue(t)}
                onBlur={() => {
                    let v = parseInt(localValue.replace(/[^0-9]/g, ''), 10)
                    if (isNaN(v)) v = min
                    if (v < min) v = min
                    if (v > max) v = max
                    setLocalValue(v.toString())
                    onChange(v)
                }}
            />
        </View>
    )
}

/**
 * Day/night light sensor flow: shows the firmware's current flash decision
 * (op25), the live AE register readings behind it, and lets the engineer tune
 * the dark threshold (op23) and periodic check interval (op24).
 */
export const LightSensorScreen = () => {
    const route = useRoute<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const { state, aeData, isBusy, stage, refresh, setParam, measureNow, enableAeFlash, setAutoSwitch } = useLightSensor({ device })
    const { issues, isChecking, refresh: recheckHealth } = useDeviceSelfTest({ device })

    const connected = !!device?.connected
    const aeMeanNum = aeData ? parseInt(aeData.aeMean, 10) : NaN
    // The firmware only runs the AE decision when something consumes it: the
    // AE-driven flash (op13 != 0) or auto camera switching (op26 = 1). With
    // both off the displayed op25 is stale - the #1 "why does it say BRIGHT
    // in a dark box?" trap.
    const aeDecisionDisabled = state.flashLed === 0 && state.autoSwitch !== 1

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { padding: spacing, gap: spacing }]} keyboardShouldPersistTaps="handled">

            <WWBleDisconnectedBanner connected={connected} dfuInProgress={!!device?.dfuInProgress} />

            <DeviceHealthBanner issues={issues} onRecheck={recheckHealth} isChecking={isChecking} />

            <WWText variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                The camera reads its light sensor (the night camera's auto-exposure) around every capture
                and periodically while deployed. In the dark it turns on the IR illumination for motion
                detection and flash for captures.
            </WWText>

            {/* ── AE mode gate warning ── */}
            {aeDecisionDisabled && (
                <Surface style={[styles.card, styles.warnCard]} elevation={1}>
                    <WWText style={styles.warnText}>
                        ⚠️ The flash is OFF (op13 = 0) and auto camera switch is off (op26 = 0),
                        so the device never runs its light check — the decision below is stale
                        and will not change, even in the dark.
                    </WWText>
                    <Button
                        mode="contained"
                        buttonColor="#FFB74D"
                        textColor="#3E2723"
                        style={{ marginTop: 8 }}
                        onPress={enableAeFlash}
                        disabled={!connected || isBusy}
                    >
                        Enable light-driven flash (IR)
                    </Button>
                </Surface>
            )}

            {/* ── Current decision ── */}
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <View style={styles.row}>
                    <WWText variant="titleSmall">Light decision</WWText>
                    <Button compact mode="text" onPress={refresh} disabled={!connected || isBusy}>
                        Refresh
                    </Button>
                </View>
                <WWText variant="headlineSmall" style={{ marginVertical: 4 }}>
                    {state.flashState === null
                        ? '— not read yet'
                        : state.flashState === 1
                            ? '🌙 DARK — flash will fire'
                            : '☀️ BRIGHT — no flash'}
                </WWText>
                <Button
                    mode="contained"
                    onPress={measureNow}
                    loading={isBusy}
                    disabled={!connected || isBusy}
                    style={{ marginTop: 8 }}
                >
                    <WWText style={{ color: 'white' }}>{isBusy ? (stage || 'Measuring…') : 'Measure light now'}</WWText>
                </Button>
                <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginTop: 6 }}>
                    Triggers a capture so the device samples the light and updates its decision (~10 s).
                </WWText>
            </Surface>

            {/* ── Live AE readings ── */}
            {aeData && (
                <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                    <WWText variant="titleSmall" style={{ marginBottom: 8 }}>Sensor readings (last capture)</WWText>
                    <View style={styles.row}>
                        <WWText variant="labelMedium">AE Mean (0–255):</WWText>
                        <WWText>{aeData.aeMean}{!isNaN(aeMeanNum) ? (aeMeanNum < state.darkThreshold ? '  (below threshold → dark)' : '  (above threshold → bright)') : ''}</WWText>
                    </View>
                    {!isNaN(aeMeanNum) && (
                        <View style={[styles.meanBarTrack, { backgroundColor: colors.surfaceVariant }]}>
                            {/* threshold marker + level */}
                            <View style={[styles.meanBarFill, { width: `${(aeMeanNum / 255) * 100}%`, backgroundColor: colors.primary }]} />
                            <View style={[styles.thresholdMark, { left: `${(state.darkThreshold / 255) * 100}%`, backgroundColor: colors.error }]} />
                        </View>
                    )}
                    <Divider style={styles.divider} />
                    <View style={styles.row}>
                        <WWText variant="labelMedium">Integration:</WWText>
                        <WWText>{aeData.integration} lines</WWText>
                    </View>
                    <View style={styles.row}>
                        <WWText variant="labelMedium">Analog / digital gain:</WWText>
                        <WWText>{aeData.analogGain} / {aeData.digitalGain}</WWText>
                    </View>
                    <View style={styles.row}>
                        <WWText variant="labelMedium">AE converged:</WWText>
                        <WWText>{aeData.aeConverged.toUpperCase() === 'Y' ? '✅ Yes' : '⏳ No'}</WWText>
                    </View>
                </Surface>
            )}

            {/* ── Auto camera switch (op26) ── */}
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <View style={styles.row}>
                    <WWText variant="titleSmall">Auto camera switch</WWText>
                    <Switch
                        value={state.autoSwitch === 1}
                        onValueChange={setAutoSwitch}
                        disabled={!connected || isBusy || state.autoSwitch === null}
                    />
                </View>
                <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginTop: 4 }}>
                    When on, the light sensor also picks the camera: in the dark the device reboots
                    into the 🌙 night (HM0360) image, and in daylight back into the 🎨 colour (RP3)
                    image. The switch happens at the next sleep after a light check, and both camera
                    images must be installed (use “Update both cameras” in Firmware Update).
                </WWText>
                {state.autoSwitch === null && (
                    <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginTop: 6, fontStyle: 'italic' }}>
                        Not supported by this device's firmware (op26 not reported).
                    </WWText>
                )}
            </Surface>

            {/* ── Tuning ── */}
            <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                <WWText variant="titleSmall" style={{ marginBottom: 4 }}>Tuning</WWText>
                <WWText variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginBottom: 12 }}>
                    Changes write to the device immediately and persist across sleep.
                </WWText>
                <NumericInput
                    label="Dark threshold (op23, AE mean 0-255)"
                    value={state.darkThreshold}
                    onChange={(v: number) => { setParam('darkThreshold', v) }}
                    min={0}
                    max={255}
                    disabled={!connected || isBusy}
                />
                <NumericInput
                    label="Check interval (op24, minutes, 0 = off)"
                    value={state.checkInterval}
                    onChange={(v: number) => { setParam('checkInterval', v) }}
                    min={0}
                    max={1440}
                    disabled={!connected || isBusy}
                />
            </Surface>

            {isBusy && (
                <View style={styles.busyRow}>
                    <ActivityIndicator size="small" />
                    <WWText variant="labelSmall" style={{ opacity: 0.7 }}>{stage || 'Working…'}</WWText>
                </View>
            )}

            <View style={{ height: 32 }} />
        </ScrollView>
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
        borderRadius: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    divider: {
        marginVertical: 8,
    },
    meanBarTrack: {
        height: 10,
        borderRadius: 5,
        marginTop: 6,
        marginBottom: 2,
        overflow: 'hidden',
    },
    meanBarFill: {
        height: '100%',
        borderRadius: 5,
    },
    thresholdMark: {
        position: 'absolute',
        top: 0,
        width: 2,
        height: '100%',
    },
    busyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    warnCard: {
        backgroundColor: '#4E342E',
    },
    warnText: {
        color: '#FFE0B2',
    },
})
