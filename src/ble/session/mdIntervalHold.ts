import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CommandContext } from '../protocol/commandRegistry'
import { commandRegistry } from '../protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { DeviceSignal } from '../protocol/deviceSignals'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { getStorageData, storeDataToStorage } from '../../utils/helpers'
import { log, logWarn } from '../../utils/logger'

const STORAGE_PREFIX = 'mdIntervalHold:op11:'

/** The subset of a BLE session this module needs. `createBleSession` satisfies it. */
export interface MdIntervalHoldSession {
    getOps: (options?: { force?: boolean }) => Promise<string[]>
    execute: <T>(commandConstructor: () => CommandContext<T>) => Promise<T>
}

/** A restore owed on a device: the op11 to put back, and the value held over it. */
interface Owed {
    original: number
    held: number
}

interface Hold extends Owed {
    /** False when op11 already read the value asked for, so there is nothing to put back */
    changed: boolean
}

/**
 * Holds the HM0360's motion detection rate at a test's interval for the length
 * of a motion test, by writing op11 `MD_INTERVAL` and putting the previous
 * value back afterwards (#274).
 *
 * ## Why a test has to do this
 *
 * The motion grid is the HM0360's own detector, read once per test frame, and
 * how often that detector runs is programmed on the way into Deep Power Down,
 * in the firmware's `hm0360_md_prepare()`, from op11. Nothing on the awake path
 * re-arms it. So a test that leaves op11 alone runs at whatever rate the device
 * last slept with: after Stop Monitoring or a reset, op11 is 0 and the sensor
 * runs about once every two seconds with its interrupt off, and a 1 s test
 * reads each result twice, seconds late. Holding op11 at the test interval,
 * then letting the device sleep before the capture, arms it at the test's rate.
 *
 * ## Why it needs the same care as the op8 and flash holds, and more
 *
 * op11 is written to CONFIG.TXT and applies in the field. On a stopped camera
 * it is 0, and left raised it turns motion capture back on. So a hold must
 * always be undone, and the ways it can fail to be undone are handled the way
 * `keepAwake` and `flashHold` handle them: the original is remembered in memory
 * and on disk, and paid by the next motion test on that device, which keeps
 * the owed original across its own hold and writes it back on the way out.
 * Two things differ:
 *
 * - The owed record is written **before** the raise, not after. A write whose
 *   reply is lost may still have landed.
 * - A deployment writes op11 for the field, and at the same 1000 ms the Start
 *   Monitoring card tests at. From the op table alone a later test could not
 *   tell the deployment's 1000 from its own, and would "restore" a deployed
 *   camera to 0. The deployment calls `forget` before it writes, which drops
 *   the hold and anything owed.
 *
 * Nothing is written at connect time. Only a flow a person opened may write.
 */
class MdIntervalHold {
    private holdsByDevice: Map<string, Hold> = new Map()
    /** Restores owed, by device, while a raise of ours may be on the device */
    private owedByDevice: Map<string, Owed> = new Map()
    /** Devices with an `acquire` in flight */
    private acquiring: Set<string> = new Set()

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.DISCONNECT && this.holdsByDevice.delete(event.deviceId)) {
                log(`[MdIntervalHold] link to ${event.deviceId} dropped with op11 held; any restore waits for the next motion test on it`)
            }
        })
    }

    /** True while this device's op11 is being held. */
    public holds(deviceId: string): boolean {
        return this.holdsByDevice.has(deviceId)
    }

    /**
     * Write `intervalMs` to op11 and remember what to put back. Idempotent: a
     * second call while a hold is active does nothing.
     *
     * @returns true when a hold is active afterwards; false when op11 could not
     *          be read, in which case nothing was written.
     */
    public async acquire(session: MdIntervalHoldSession, deviceId: string, intervalMs: number): Promise<boolean> {
        if (this.holdsByDevice.has(deviceId)) return true
        this.acquiring.add(deviceId)
        try {
            return await this.take(session, deviceId, intervalMs)
        } finally {
            this.acquiring.delete(deviceId)
        }
    }

    private async take(session: MdIntervalHoldSession, deviceId: string, intervalMs: number): Promise<boolean> {
        const owed = await this.owed(deviceId)
        const ops = await session.getOps()
        const current = parseInt(ops?.[OP_PARAMETER.MD_INTERVAL] ?? '', 10)
        if (isNaN(current)) {
            logWarn(`[MdIntervalHold] op11 not readable on ${deviceId}; not holding the detector rate`)
            return false
        }

        // An owed original only applies while the value it was owed over is
        // still on the device. Anything else means Stop Monitoring, a reset or
        // the console has set op11 since, and that is the value to go back to.
        const original = owed !== null && current === owed.held ? owed.original : current
        const changed = intervalMs !== original

        if (changed) {
            await this.setOwed(deviceId, { original, held: intervalMs })
        } else {
            await this.clearOwed(deviceId)
        }
        if (current !== intervalMs) {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.MD_INTERVAL, value: intervalMs }))
        }

        this.holdsByDevice.set(deviceId, { original, held: intervalMs, changed })
        log(changed
            ? `[MdIntervalHold] holding the detector rate on ${deviceId}: op11 ${original} -> ${intervalMs}`
            : `[MdIntervalHold] op11 on ${deviceId} already ${intervalMs}, nothing to put back`)
        return true
    }

    /**
     * Put op11 back. Safe to call without a hold. If the write fails, the
     * restore stays owed and `restorePending` completes it later.
     */
    public async release(session: MdIntervalHoldSession, deviceId: string): Promise<void> {
        const hold = this.holdsByDevice.get(deviceId)
        if (!hold) return
        this.holdsByDevice.delete(deviceId)
        if (!hold.changed) return
        await this.writeBack(session, deviceId, hold.original, 'release')
    }

    /**
     * Write back a restore that an earlier drop, failed write or app restart
     * left owed. Nothing happens when nothing is owed, or while a hold is
     * active. For a flow to call on its way out or on entry; never from the
     * connect path, which must not write.
     */
    public async restorePending(session: MdIntervalHoldSession, deviceId: string): Promise<void> {
        // A hold being taken keeps the owed original and its release pays it;
        // paying it here as well would clear the record under the raise.
        if (this.holdsByDevice.has(deviceId) || this.acquiring.has(deviceId)) return
        const owed = await this.owed(deviceId)
        if (owed === null) return
        await this.writeBack(session, deviceId, owed.original, 'owed')
    }

    /**
     * Drop the hold and anything owed without writing. For a flow about to
     * write op11 for the field itself, the deployment: its value is the one to
     * keep, and a test still running must not put an older one back over it.
     */
    public async forget(deviceId: string): Promise<void> {
        this.holdsByDevice.delete(deviceId)
        await this.clearOwed(deviceId)
        log(`[MdIntervalHold] op11 on ${deviceId} left to the deployment; no hold or owed restore kept`)
    }

    /** Forget every hold and owed restore in memory. Tests only: disk is untouched. */
    public clear() {
        this.holdsByDevice.clear()
        this.owedByDevice.clear()
        this.acquiring.clear()
    }

    private async writeBack(session: MdIntervalHoldSession, deviceId: string, value: number, why: string): Promise<void> {
        try {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.MD_INTERVAL, value }))
            await this.clearOwed(deviceId)
            log(`[MdIntervalHold] op11 on ${deviceId} restored to ${value} (${why})`)
        } catch (e) {
            logWarn(`[MdIntervalHold] could not restore op11 on ${deviceId} to ${value} (${why}); still owed:`, e)
        }
    }

    private async owed(deviceId: string): Promise<Owed | null> {
        const inMemory = this.owedByDevice.get(deviceId)
        if (inMemory !== undefined) return inMemory
        const stored = await getStorageData<Owed>(STORAGE_PREFIX + deviceId)
        if (stored && typeof stored.original === 'number' && typeof stored.held === 'number') {
            this.owedByDevice.set(deviceId, stored)
            return stored
        }
        return null
    }

    private async setOwed(deviceId: string, value: Owed): Promise<void> {
        this.owedByDevice.set(deviceId, value)
        await storeDataToStorage(STORAGE_PREFIX + deviceId, value)
    }

    private async clearOwed(deviceId: string): Promise<void> {
        this.owedByDevice.delete(deviceId)
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + deviceId)
        } catch (e) {
            logWarn('[MdIntervalHold] could not clear the stored restore:', e)
        }
    }
}

/** Module-level singleton, shared by every session. */
export const mdIntervalHold = new MdIntervalHold()
