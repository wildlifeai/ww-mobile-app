import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { OP_PARAMETER } from './useDeviceSettings'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { log, logError } from '../utils/logger'
import type { AEData } from '../screens/Devices/hooks/useCameraSettingsTest'

export interface LightSensorState {
    darkThreshold: number      // op23 - AE mean below this = dark
    checkInterval: number      // op24 - minutes between periodic AE checks (0 = off)
    flashState: number | null  // op25 - last AE flash decision (1 = dark/flash, 0 = bright); null = not read yet
    flashLed: number | null    // op13 - 0 = flash OFF, 1 = visible, 2 = IR (the light check runs when op13 != 0 OR op26 = 1)
    autoSwitch: number | null  // op26 - 1 = automatic day/night camera switching; null = not read yet / older firmware
}

const DEFAULTS: LightSensorState = {
    darkThreshold: 65,
    checkInterval: 15,
    flashState: null,
    flashLed: null,
    autoSwitch: null,
}

/** Parse one op value out of a getops array; fallback when absent (older firmware). */
const opInt = (ops: string[], index: number, fallback: number): number => {
    if (!ops || ops.length <= index) return fallback
    const v = parseInt(ops[index], 10)
    return isNaN(v) ? fallback : v
}

/**
 * The WW500's day/night light sensor: the HM0360's auto-exposure registers,
 * averaged over several frames by the firmware, drive the flash decision
 * (op25). This hook reads that state, lets the engineer tune the dark
 * threshold (op23) and check interval (op24), and can trigger a capture to
 * force a fresh measurement.
 */
export const useLightSensor = ({ device }: { device: ExtendedPeripheral | undefined }) => {
    const [state, setState] = useState<LightSensorState>(DEFAULTS)
    const [aeData, setAeData] = useState<AEData | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState<string>('')

    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    // Live AE register lines arrive over BLE after each capture / AE check.
    // Format: "HM0360 AE regs: / Integration time = ... / AE Mean = ... / AEConverged?: Y"
    useEffect(() => {
        const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return
            const msg = event.line
            setAeData(prev => {
                const next = { ...(prev || { integration: '', analogGain: '', digitalGain: '', aeMean: '', aeConverged: '' }) }
                let updated = false
                const grab = (re: RegExp, key: keyof AEData) => {
                    const m = msg.match(re)
                    if (m) { next[key] = m[1]; updated = true }
                }
                grab(/Integration time\s*=\s*(\d+)/i, 'integration')
                grab(/Analog gain\s*=\s*(\d+)/i, 'analogGain')
                grab(/Digital gain\s*=\s*(\d+)/i, 'digitalGain')
                grab(/AE Mean\s*=\s*(\d+)/i, 'aeMean')
                grab(/AEConverged\?:\s*(Y|N)/i, 'aeConverged')
                return updated ? (next as AEData) : prev
            })
        }
        bleEventBus.on('textLine', listener)
        return () => { bleEventBus.removeListener('textLine', listener) }
    }, [device])

    /** Read op23/24/25 from the device. */
    const refresh = useCallback(async () => {
        if (!device?.connected) return
        try {
            const session = createBleSession(device)
            const ops = await session.execute(() => commandRegistry.getops())
            if (unmountedRef.current) return
            setState(prev => ({
                darkThreshold: opInt(ops, OP_PARAMETER.AE_DARK_THRESHOLD, prev.darkThreshold),
                checkInterval: opInt(ops, OP_PARAMETER.AE_CHECK_INTERVAL, prev.checkInterval),
                flashState: ops.length > OP_PARAMETER.AE_FLASH_STATE
                    ? opInt(ops, OP_PARAMETER.AE_FLASH_STATE, 0)
                    : null,
                flashLed: ops.length > OP_PARAMETER.FLASH_LED
                    ? opInt(ops, OP_PARAMETER.FLASH_LED, 0)
                    : null,
                autoSwitch: ops.length > OP_PARAMETER.SLOT_SWITCH
                    ? opInt(ops, OP_PARAMETER.SLOT_SWITCH, 0)
                    : null,
            }))
        } catch (e) {
            logError('[LightSensor] refresh failed:', e)
        }
    }, [device])

    // Seed on connect
    const didSeedRef = useRef(false)
    useEffect(() => {
        if (!device?.connected || didSeedRef.current) return
        didSeedRef.current = true
        refresh()
    }, [device?.connected, refresh])

    /** Write a tuning value (op23/op24) immediately. */
    const setParam = useCallback(async (key: 'darkThreshold' | 'checkInterval', value: number) => {
        setState(prev => ({ ...prev, [key]: value }))
        if (!device?.connected) return
        const index = key === 'darkThreshold' ? OP_PARAMETER.AE_DARK_THRESHOLD : OP_PARAMETER.AE_CHECK_INTERVAL
        setIsBusy(true)
        setStage('Saving…')
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index, value }))
        } catch (e) {
            logError('[LightSensor] setop failed:', e)
            Alert.alert('Update failed', `Could not write op${index} to the device.`)
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Enable/disable automatic day/night camera switching (op26). When on,
     * the device reboots into the night (HM0360) image in the dark and back
     * into the colour (RP3) image in daylight, at the next sleep after a
     * light check. The light check runs even with the flash off.
     */
    const setAutoSwitch = useCallback(async (enabled: boolean) => {
        if (!device?.connected) return
        setIsBusy(true)
        setStage(`${enabled ? 'Enabling' : 'Disabling'} auto camera switch (op26)…`)
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.SLOT_SWITCH, value: enabled ? 1 : 0 }))
            if (!unmountedRef.current) setState(prev => ({ ...prev, autoSwitch: enabled ? 1 : 0 }))
        } catch (e) {
            logError('[LightSensor] set auto switch failed:', e)
            Alert.alert('Update failed', 'Could not set op26 (auto camera switch) on the device.')
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Enable the AE-driven flash (op13 = 2, IR) so the light-sensor decision
     * actually runs — with op13 = 0 (and auto camera switch op26 off) the
     * firmware skips AE sampling entirely and op25 never updates.
     */
    const enableAeFlash = useCallback(async () => {
        if (!device?.connected) return
        setIsBusy(true)
        setStage('Enabling AE flash (op13 = IR)…')
        try {
            const session = createBleSession(device)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: 2 }))
            if (!unmountedRef.current) setState(prev => ({ ...prev, flashLed: 2 }))
        } catch (e) {
            logError('[LightSensor] enable AE flash failed:', e)
            Alert.alert('Update failed', 'Could not set op13 (flash LED) on the device.')
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device])

    /**
     * Force a fresh light measurement: trigger a single capture (the firmware
     * samples the AE registers around each capture and updates op25), wait for
     * the device to process it, then re-read the decision.
     */
    const measureNow = useCallback(async () => {
        if (!device?.connected || isBusy) return
        setIsBusy(true)
        try {
            setStage('Requesting capture…')
            const session = createBleSession(device)
            await session.waitForSleep(3000)
            try {
                await session.execute(() => commandRegistry.capture(1, 500))
            } catch (e: any) {
                // A stopped deployment can leave the camera system disabled -
                // recover automatically instead of failing the measurement.
                // op10 must be set persistently: the enabled flag is reloaded
                // from it on EVERY wake, so a runtime 'enable' alone evaporates
                // the moment the device sleeps (~1 s of inactivity).
                if (!/not enabled/i.test(String(e?.message ?? e))) throw e
                setStage('Camera was disabled — re-enabling (op10)…')
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }))
                await session.execute(() => commandRegistry.enableCamera())
                setStage('Requesting capture…')
                await session.execute(() => commandRegistry.capture(1, 500))
            }
            setStage('Measuring light (AE sampling)…')
            // The multi-frame AE average + capture takes a few seconds; the AE
            // lines stream in via the listener above as they happen.
            await new Promise(r => setTimeout(r, 6000))
            setStage('Reading decision…')
            await refresh()
            log('[LightSensor] measurement complete')
        } catch (e: any) {
            logError('[LightSensor] measure failed:', e)
            Alert.alert('Measurement failed', e?.message ?? String(e))
        } finally {
            if (!unmountedRef.current) { setIsBusy(false); setStage('') }
        }
    }, [device, isBusy, refresh])

    return { state, aeData, isBusy, stage, refresh, setParam, measureNow, enableAeFlash, setAutoSwitch }
}
