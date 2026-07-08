import { useState, useCallback, useEffect, useRef } from 'react'

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { parseSelfTestBits, decodeSelfTest, SelfTestIssue } from '../utils/deviceSelfTest'
import { log, logWarn } from '../utils/logger'

/**
 * Device hardware health via the self-test bitmask.
 *
 * Runs the `selftest` command once when the device connects (and on demand via
 * refresh) and decodes the bits into human-readable issues - e.g. a
 * disconnected HM0360 sensor, missing SD card or low battery - so screens can
 * warn the user instead of failing mysteriously later.
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

    const refresh = useCallback(async () => {
        if (!device?.connected) return
        setIsChecking(true)
        try {
            const session = createBleSession(device)
            const raw = await session.execute(() => commandRegistry.selftest())
            const parsed = parseSelfTestBits(raw)
            if (unmountedRef.current) return
            if (parsed !== null) {
                setBits(parsed)
                setIssues(decodeSelfTest(parsed))
                log(`[SelfTest] bits=0x${parsed.toString(16).padStart(4, '0')}`)
            }
        } catch (e) {
            // Non-fatal: health stays "unknown" - screens simply show no banner.
            logWarn('[SelfTest] query failed:', e)
        } finally {
            if (!unmountedRef.current) setIsChecking(false)
        }
    }, [device])

    // Check once per connection
    const checkedRef = useRef(false)
    useEffect(() => {
        if (!device?.connected) {
            checkedRef.current = false
            return
        }
        if (checkedRef.current) return
        checkedRef.current = true
        refresh()
    }, [device?.connected, refresh])

    return { bits, issues, isChecking, refresh }
}
