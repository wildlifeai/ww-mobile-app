import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CommandContext } from '../protocol/commandRegistry'
import { commandRegistry } from '../protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { DeviceSignal } from '../protocol/deviceSignals'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { getStorageData, storeDataToStorage } from '../../utils/helpers'
import { log, logWarn } from '../../utils/logger'

const STORAGE_PREFIX = 'flashLedHold:op13op9:'

/** The subset of a BLE session this module needs. `createBleSession` satisfies it. */
export interface FlashLedHoldSession {
    getOps: (options?: { force?: boolean }) => Promise<string[]>
    execute: <T>(commandConstructor: () => CommandContext<T>) => Promise<T>
}

/** What a test lights its frames with: op13 the LED (1 white, 2 IR), op9 its brightness in percent. */
export interface FlashLedSettings {
    led: number
    brightness: number
}

/** One op the hold changed: the value to put back, and the value written over it. */
interface HeldOp {
    index: number
    original: number
    held: number
}

/**
 * Holds the capture flash's LED and brightness, op13 `FLASH_LED` and op9
 * `LED_BRIGHTNESS`, at a motion test's choice for the length of the test, and
 * puts the previous values back afterwards (#387).
 *
 * ## Why a test has to hold them rather than write them
 *
 * Both are written to CONFIG.TXT and are what the camera's own photos use. The
 * motion test wrote them with a plain `setop` and never put them back, so after
 * a test with IR at 50 % every photo the camera took used IR at 50 %. Capture
 * Picture writes the same two on purpose, as the device's settings; the motion
 * test only borrows them, which is why it holds them here.
 *
 * op13 also decides whether the camera flashes while it sleeps. The firmware
 * arms the HM0360's STROBE on the way into Deep Power Down when
 * `ledFlashIsActive()` is non-zero, op11 is non-zero and op21 names an LED, and
 * `ledFlashIsActive()` returns op13, read live, whenever the flash is armed.
 * The flash mode is only read at wake, and the test's own wake read op34 at
 * always-on (`flashHold`), so an op13 left at the test's LED lit op21's LED on
 * every motion frame of the sleep that followed the test (#383), however
 * promptly op34 went back. Released in the test's cleanup, which runs inside
 * that wake, op13 is back before the sleep.
 *
 * ## Why it needs the same care as the other holds
 *
 * A ref dies with a dropped link or a killed app, and #383 is an app that
 * crashes during these tests. So the originals go to disk **before** the
 * writes, as `mdIntervalHold` does, since a write whose reply is lost may have
 * landed, and the next motion test on the device pays them back. A restore is
 * only paid while the device still reads the value the hold wrote: a value set
 * since, from Capture Picture or Device Settings, is someone's choice. A
 * deployment writes op13 for the field, and its reset op9, so it calls
 * `forget` first: the project's LED can be the one a test held.
 *
 * Nothing is written at connect time. Only a flow a person opened may write.
 */
class FlashLedHold {
    /** The ops each hold changed, by device; empty when the device already read the test's values */
    private holdsByDevice: Map<string, HeldOp[]> = new Map()
    /** Restores owed, by device, while a write of ours may be on the device */
    private owedByDevice: Map<string, HeldOp[]> = new Map()
    /** Devices with an `acquire` in flight */
    private acquiring: Set<string> = new Set()

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.DISCONNECT && this.holdsByDevice.delete(event.deviceId)) {
                log(`[FlashLedHold] link to ${event.deviceId} dropped with op13 and op9 held; any restore waits for the next motion test on it`)
            }
        })
    }

    /** True while this device's flash LED and brightness are being held. */
    public holds(deviceId: string): boolean {
        return this.holdsByDevice.has(deviceId)
    }

    /**
     * Write the test's LED and brightness and remember what to put back.
     * Idempotent: a second call while a hold is active does nothing.
     *
     * @returns true when a hold is active afterwards; false when op13 or op9
     *          could not be read, in which case nothing was written.
     */
    public async acquire(session: FlashLedHoldSession, deviceId: string, settings: FlashLedSettings): Promise<boolean> {
        if (this.holdsByDevice.has(deviceId)) return true
        this.acquiring.add(deviceId)
        try {
            return await this.take(session, deviceId, settings)
        } finally {
            this.acquiring.delete(deviceId)
        }
    }

    private async take(session: FlashLedHoldSession, deviceId: string, settings: FlashLedSettings): Promise<boolean> {
        const owed = await this.owed(deviceId)
        const ops = await session.getOps()
        const wanted = [
            { index: OP_PARAMETER.FLASH_LED, value: settings.led },
            { index: OP_PARAMETER.LED_BRIGHTNESS, value: settings.brightness },
        ]
        const current = wanted.map(({ index }) => parseInt(ops?.[index] ?? '', 10))
        if (current.some(isNaN)) {
            logWarn(`[FlashLedHold] op13 or op9 not readable on ${deviceId}; leaving the flash settings as they are`)
            return false
        }

        // An owed original only applies while the value it was owed over is
        // still on the device. Anything else was set since, and is the value
        // to go back to.
        const changed: HeldOp[] = []
        wanted.forEach(({ index, value }, i) => {
            const before = owed?.find(o => o.index === index)
            const original = before && current[i] === before.held ? before.original : current[i]
            if (original !== value) changed.push({ index, original, held: value })
        })

        if (changed.length > 0) {
            await this.setOwed(deviceId, changed)
        } else {
            await this.clearOwed(deviceId)
        }
        for (let i = 0; i < wanted.length; i++) {
            const { index, value } = wanted[i]
            if (current[i] !== value) {
                await session.execute(() => commandRegistry.setop({ index, value }))
            }
        }

        this.holdsByDevice.set(deviceId, changed)
        log(changed.length > 0
            ? `[FlashLedHold] holding the flash on ${deviceId}: ${changed.map(h => `op${h.index} ${h.original} -> ${h.held}`).join(', ')}`
            : `[FlashLedHold] op13 and op9 on ${deviceId} already ${settings.led} and ${settings.brightness}, nothing to put back`)
        return true
    }

    /**
     * Put op13 and op9 back. Safe to call without a hold. A write that fails
     * stays owed, and `restorePending` completes it later.
     */
    public async release(session: FlashLedHoldSession, deviceId: string): Promise<void> {
        const hold = this.holdsByDevice.get(deviceId)
        if (!hold) return
        this.holdsByDevice.delete(deviceId)
        if (hold.length === 0) return
        await this.writeBack(session, deviceId, hold, 'release')
    }

    /**
     * Write back a restore that an earlier drop, failed write or app restart
     * left owed, for the ops the device still holds at our value. Nothing
     * happens when nothing is owed, or while a hold is active or being taken.
     * For a flow to call on its way out or on entry; never from the connect
     * path, which must not write.
     */
    public async restorePending(session: FlashLedHoldSession, deviceId: string): Promise<void> {
        // A hold being taken keeps the owed original and its release pays it;
        // paying it here as well would clear the record under the write.
        if (this.holdsByDevice.has(deviceId) || this.acquiring.has(deviceId)) return
        const owed = await this.owed(deviceId)
        if (owed === null) return

        let ops: string[]
        try {
            ops = await session.getOps()
        } catch (e) {
            logWarn(`[FlashLedHold] could not read op13 and op9 on ${deviceId}; the restore stays owed:`, e)
            return
        }
        const stillOurs = owed.filter(o => parseInt(ops?.[o.index] ?? '', 10) === o.held)
        if (stillOurs.length === 0) {
            await this.clearOwed(deviceId)
            log(`[FlashLedHold] op13 and op9 on ${deviceId} have been set since the test; nothing to put back`)
            return
        }
        await this.writeBack(session, deviceId, stillOurs, 'owed')
    }

    /**
     * Drop the hold and anything owed without writing. For a deployment, which
     * writes op13 (and, through its reset, op9) for the field: its values are
     * the ones to keep, and a restore owed from before it must not put a test's
     * original back over them.
     */
    public async forget(deviceId: string): Promise<void> {
        this.holdsByDevice.delete(deviceId)
        await this.clearOwed(deviceId)
        log(`[FlashLedHold] op13 and op9 on ${deviceId} left to the deployment; no hold or owed restore kept`)
    }

    /** Forget every hold and owed restore in memory. Tests only: disk is untouched. */
    public clear() {
        this.holdsByDevice.clear()
        this.owedByDevice.clear()
        this.acquiring.clear()
    }

    private async writeBack(session: FlashLedHoldSession, deviceId: string, entries: HeldOp[], why: string): Promise<void> {
        const failed: HeldOp[] = []
        for (const entry of entries) {
            try {
                await session.execute(() => commandRegistry.setop({ index: entry.index, value: entry.original }))
            } catch (e) {
                failed.push(entry)
                logWarn(`[FlashLedHold] could not restore op${entry.index} on ${deviceId} to ${entry.original} (${why}); still owed:`, e)
            }
        }
        if (failed.length > 0) {
            await this.setOwed(deviceId, failed)
            return
        }
        await this.clearOwed(deviceId)
        log(`[FlashLedHold] ${entries.map(e => `op${e.index}`).join(' and ')} on ${deviceId} restored to ${entries.map(e => e.original).join(' and ')} (${why})`)
    }

    private async owed(deviceId: string): Promise<HeldOp[] | null> {
        const inMemory = this.owedByDevice.get(deviceId)
        if (inMemory !== undefined) return inMemory
        const stored = await getStorageData<HeldOp[]>(STORAGE_PREFIX + deviceId)
        const valid = Array.isArray(stored)
            && stored.length > 0
            && stored.every(o => typeof o?.index === 'number' && typeof o?.original === 'number' && typeof o?.held === 'number')
        if (valid) {
            this.owedByDevice.set(deviceId, stored)
            return stored
        }
        return null
    }

    private async setOwed(deviceId: string, value: HeldOp[]): Promise<void> {
        this.owedByDevice.set(deviceId, value)
        await storeDataToStorage(STORAGE_PREFIX + deviceId, value)
    }

    private async clearOwed(deviceId: string): Promise<void> {
        this.owedByDevice.delete(deviceId)
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + deviceId)
        } catch (e) {
            logWarn('[FlashLedHold] could not clear the stored restore:', e)
        }
    }
}

/** Module-level singleton, shared by every session. */
export const flashLedHold = new FlashLedHold()
