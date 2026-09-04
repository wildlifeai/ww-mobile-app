import { useState, useCallback, useEffect, useRef } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { selfTestCache } from '../ble/protocol/selfTestCache'
import { parseSelfTestBits, decodeSelfTest, isBootPreset, formatSelfTestBits, SelfTestIssue } from '../utils/deviceSelfTest'
import { log, logWarn } from '../utils/logger'

/**
 * Device hardware health via the self-test bitmask.
 *
 * Decodes the bits into human-readable issues - e.g. a disconnected HM0360
 * sensor, missing SD card or low battery - so screens can warn the user instead
 * of failing mysteriously later.
 *
 * The device announces its bits after every wake, and the shared
 * `selfTestCache` keeps the latest. This hook shows what the cache holds and
 * follows every broadcast; it sends `selftest` itself only when the cache has
 * nothing from after a wake on this connection, or when a screen asks for a
 * refresh outright. The Capture Picture card used to send one on every entry
 * (#268 follow-up).
 */
export const useDeviceSelfTest = ({ device }: { device: ExtendedPeripheral | undefined }) => {
    const [bits, setBits] = useState<number | null>(null)   // null = not read yet
    const [issues, setIssues] = useState<SelfTestIssue[]>([])
    const [isChecking, setIsChecking] = useState(false)

    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => { unmountedRef.current = true }
    }, [])

    const apply = useCallback((value: number) => {
        if (unmountedRef.current) return
        setBits(value)
        setIssues(decodeSelfTest(value))
    }, [])

    // Free and always current: the cache hears every wake's broadcast.
    useEffect(() => {
        if (!device?.id) return
        const held = selfTestCache.get(device.id)
        if (held?.postWake) apply(held.bits)
        return selfTestCache.subscribe(device.id, reading => {
            log(`[SelfTest] device reports ${formatSelfTestBits(reading.bits)}`)
            apply(reading.bits)
        })
    }, [device?.id, apply])

    /**
     * Ask the device. `force` re-sends `selftest` even when the cache holds a
     * post-wake reading; the automatic check on connect passes false.
     */
    const refresh = useCallback(async (force = true) => {
        if (!device?.connected) return
        if (!force) {
            // The screen that mounted this usually wakes the device itself within
            // a second (Capture Picture reads the ops on entry), and the wake's
            // broadcast answers the question. Wait for it before asking; on the
            // bench the check fired first and its `selftest` queued behind the
            // wake, so the reply arrived after the broadcast it duplicated.
            const held = await selfTestCache.waitForFresh(device.id, 0, 2500)
            if (unmountedRef.current) return
            if (held) {
                apply(held.bits)
                return
            }
        }
        setIsChecking(true)
        try {
            const session = createBleSession(device)
            const raw = await session.execute(() => commandRegistry.selftest())
            const parsed = parseSelfTestBits(raw)
            if (unmountedRef.current) return
            if (parsed !== null && !isBootPreset(parsed)) {
                apply(parsed)
                log(`[SelfTest] bits=${formatSelfTestBits(parsed)}`)
            }
        } catch (e) {
            // Non-fatal: health stays "unknown" - screens simply show no banner.
            logWarn('[SelfTest] query failed:', e)
        } finally {
            if (!unmountedRef.current) setIsChecking(false)
        }
    }, [device, apply])

    // Check once per connection, from the cache when it can
    const checkedRef = useRef(false)
    useEffect(() => {
        if (!device?.connected) {
            checkedRef.current = false
            return
        }
        if (checkedRef.current) return
        checkedRef.current = true
        refresh(false)
    }, [device?.connected, refresh])

    return { bits, issues, isChecking, refresh }
}
