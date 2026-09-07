import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CommandContext } from '../protocol/commandRegistry'
import { commandRegistry } from '../protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { DeviceSignal } from '../protocol/deviceSignals'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { getStorageData, storeDataToStorage } from '../../utils/helpers'
import { log, logWarn } from '../../utils/logger'

/** op34 FLASH_MODE, always on: the flash fires on every capture, whatever the light. */
export const FLASH_MODE_ALWAYS_ON = 2

const STORAGE_PREFIX = 'flashHold:op34:'

/** The subset of a BLE session this module needs. `createBleSession` satisfies it. */
export interface FlashHoldSession {
    getOps: (options?: { force?: boolean }) => Promise<string[]>
    execute: <T>(commandConstructor: () => CommandContext<T>) => Promise<T>
}

interface Hold {
    /** The value op34 goes back to when the hold is released */
    originalMode: number
    /** False when the device already held the mode we asked for, so there is nothing to put back */
    changed: boolean
}

/**
 * Holds the capture flash armed for the length of a bench visit, by writing
 * op34 `FLASH_MODE` and putting the previous value back afterwards.
 *
 * ## Why a screen has to do this
 *
 * op13 only chooses the LED. Whether a capture lights it is `ledFlashIsActive()`
 * in the firmware: op13 non-zero **and** the mode's own arming test. In mode 1
 * (AE, the shipped default) that test is the device's last light verdict, so a
 * flash chosen on a bench screen in a lit room never fires - the check after
 * every capture says BRIGHT and the next capture stays dark. Mode 2 arms it
 * unconditionally, which is what "flash this picture" means on those screens.
 *
 * This replaces the interim `setop 25 1` write those screens used before
 * `ae_review` gave the firmware a real mode parameter (#283). op25 is runtime
 * state the firmware rewrites after every check; op34 is a setting, which is
 * why it can be held and restored honestly.
 *
 * ## Why it needs the same care as the op8 hold
 *
 * op34 is written to CONFIG.TXT and applies in the field. A device left in
 * always-on flashes every capture all night, which is battery and, with the
 * white LED, a light in a forest. So a hold must always be undone, and the two
 * ways it can fail to be undone are handled the way `keepAwake` handles them:
 * the original is remembered in memory and on disk, and written back on the
 * next visit if the link drops or the app is killed first.
 *
 * Nothing is written at connect time. Only a flow a person opened may write.
 */
class FlashHold {
    private holdsByDevice: Map<string, Hold> = new Map()
    /** Restores owed, by device: the original op34 while a hold is in effect */
    private owedByDevice: Map<string, number> = new Map()

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.DISCONNECT && this.holdsByDevice.delete(event.deviceId)) {
                log(`[FlashHold] link to ${event.deviceId} dropped with the flash held; restore deferred to the next visit`)
            }
        })
    }

    /** True while this device's flash mode is being held. */
    public holds(deviceId: string): boolean {
        return this.holdsByDevice.has(deviceId)
    }

    /**
     * Write `mode` to op34 and remember what to put back. Idempotent: a second
     * call while a hold is active does nothing.
     *
     * @returns true when a hold is active afterwards; false when the firmware
     *          has no flash mode or op34 could not be read, in which case
     *          nothing was written.
     */
    public async acquire(
        session: FlashHoldSession,
        deviceId: string,
        mode: number = FLASH_MODE_ALWAYS_ON
    ): Promise<boolean> {
        if (this.holdsByDevice.has(deviceId)) return true

        const owed = await this.owed(deviceId)
        const ops = await session.getOps()

        // Firmware older than ae_review has no op34: the write would bounce off
        // its bounds check, and those builds gate the flash on op25 instead.
        if (!ops || ops.length <= OP_PARAMETER.FLASH_MODE) {
            logWarn(`[FlashHold] ${deviceId} reports ${ops?.length ?? 0} parameters, so it has no flash mode; not holding it`)
            return false
        }

        const current = parseInt(ops[OP_PARAMETER.FLASH_MODE] ?? '', 10)
        if (isNaN(current)) {
            logWarn(`[FlashHold] op34 not readable on ${deviceId}; not holding the flash`)
            return false
        }

        // An owed original only applies while our write is still on the device.
        // If op34 now reads as something else, a deployment, a reset or a
        // console command has set it since, and that is the value to go back to.
        const originalMode = owed !== null && current === mode ? owed : current

        const write = current !== mode
        if (write) {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_MODE, value: mode }))
        }

        const changed = mode !== originalMode
        this.holdsByDevice.set(deviceId, { originalMode, changed })
        if (changed) {
            await this.setOwed(deviceId, originalMode)
            log(`[FlashHold] holding the flash on ${deviceId}: op34 ${originalMode} -> ${mode}`)
        } else {
            await this.clearOwed(deviceId)
            log(`[FlashHold] flash on ${deviceId} already in mode ${mode}, nothing to put back`)
        }
        return true
    }

    /**
     * Put op34 back. Safe to call without a hold. If the write fails, the
     * restore stays owed and `restorePending` completes it later.
     */
    public async release(session: FlashHoldSession, deviceId: string): Promise<void> {
        const hold = this.holdsByDevice.get(deviceId)
        if (!hold) return
        this.holdsByDevice.delete(deviceId)
        if (!hold.changed) return
        await this.writeBack(session, deviceId, hold.originalMode, 'release')
    }

    /**
     * Write back a restore that an earlier drop or app restart left owed.
     * Nothing happens when nothing is owed, or while a hold is active. For a
     * flow to call on entry; never from the connect path, which must not write.
     */
    public async restorePending(session: FlashHoldSession, deviceId: string): Promise<void> {
        if (this.holdsByDevice.has(deviceId)) return
        const owed = await this.owed(deviceId)
        if (owed === null) return
        await this.writeBack(session, deviceId, owed, 'reconnect')
    }

    /** Forget every hold and owed restore in memory. Tests only: disk is untouched. */
    public clear() {
        this.holdsByDevice.clear()
        this.owedByDevice.clear()
    }

    private async writeBack(session: FlashHoldSession, deviceId: string, value: number, why: string): Promise<void> {
        try {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_MODE, value }))
            await this.clearOwed(deviceId)
            log(`[FlashHold] op34 on ${deviceId} restored to ${value} (${why})`)
        } catch (e) {
            logWarn(`[FlashHold] could not restore op34 on ${deviceId} to ${value} (${why}); will retry on the next visit:`, e)
        }
    }

    private async owed(deviceId: string): Promise<number | null> {
        const inMemory = this.owedByDevice.get(deviceId)
        if (inMemory !== undefined) return inMemory
        const stored = await getStorageData<number>(STORAGE_PREFIX + deviceId)
        if (typeof stored === 'number') {
            this.owedByDevice.set(deviceId, stored)
            return stored
        }
        return null
    }

    private async setOwed(deviceId: string, value: number): Promise<void> {
        this.owedByDevice.set(deviceId, value)
        await storeDataToStorage(STORAGE_PREFIX + deviceId, value)
    }

    private async clearOwed(deviceId: string): Promise<void> {
        this.owedByDevice.delete(deviceId)
        try {
            await AsyncStorage.removeItem(STORAGE_PREFIX + deviceId)
        } catch (e) {
            logWarn('[FlashHold] could not clear the stored restore:', e)
        }
    }
}

/** Module-level singleton, shared by every session. */
export const flashHold = new FlashHold()
