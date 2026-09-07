import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CommandContext } from '../protocol/commandRegistry'
import { commandRegistry } from '../protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { DeviceSignal } from '../protocol/deviceSignals'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { getStorageData, storeDataToStorage } from '../../utils/helpers'
import { log, logWarn } from '../../utils/logger'

/**
 * How long the device stays awake after its last activity while a screen
 * holds it: 3 s.
 *
 * Long enough that `txfile` sent straight after `Captured` never races the
 * Save State that precedes sleep (the gap measured under 1 s). Deliberately
 * not longer, because the firmware applies most parameters at wake, not on
 * `setop`: the flash LED and brightness (op13, op9) are selected in
 * `setupLEDFlash()` when the device wakes, and a camera switch resets the
 * device when it next sleeps. A 20 s hold, tried on 3 September 2026, meant a
 * changed flash would not reach the next capture and a camera switch never
 * happened while the app polled for it. With 3 s the device is asleep again by
 * the time an operator has changed a setting and tapped Capture, and the
 * capture's wake applies it.
 */
export const DEFAULT_HOLD_MS = 3000

const STORAGE_PREFIX = 'keepAwake:op8:'

/** The subset of a BLE session this module needs. `createBleSession` satisfies it. */
export interface KeepAwakeSession {
    getOps: (options?: { force?: boolean }) => Promise<string[]>
    execute: <T>(commandConstructor: () => CommandContext<T>) => Promise<T>
}

interface Hold {
    /** The value op8 goes back to when the hold is released */
    originalDpd: number
    /** False when the device already slept later than the hold asks, so there is nothing to put back */
    raised: boolean
}

/**
 * Keeps a device awake for the length of a screen visit, by raising its
 * inactivity timeout (op8, INTERVAL_BEFORE_DPD) and putting it back afterwards.
 *
 * The Himax drops into Deep Power Down about a second after its last activity,
 * and every command the app sends after that pays a wake: boot, self-test,
 * then the command. A capture from the app is three commands with a wait for
 * sleep between each, measured at 22 s for a 13 KB image on 3 September 2026,
 * of which only 11 s was the transfer. Holding the device awake lets the
 * transfer follow the capture at once, without the wait and the wake in
 * between, which measured 13 s for the same capture.
 *
 * ## Why this needs care
 *
 * op8 is not a session setting. It is written to CONFIG.TXT and applies in the
 * field: a device left raised stays awake that long after every motion
 * capture, which is battery. So a hold must always be undone, and the two ways
 * a hold can fail to be undone are handled:
 *
 * - **The link drops while a hold is active.** The write back cannot go over a
 *   dead link, so the original value is remembered, in memory and on disk. It
 *   is written back the next time a flow takes a hold on that device: `acquire`
 *   keeps the owed original and `release` restores it. A flow may also settle
 *   it on entry with `restorePending` without holding.
 * - **The app is killed while a hold is active.** Same answer: the value on
 *   disk survives the restart.
 *
 * Nothing is written at connect time, on purpose: the Engineer Console must
 * connect and change nothing, and only the flows a user opens may write. The
 * cost is that a device dropped mid-hold stays at the hold value (3 s) until
 * that flow is opened again, which is a small one.
 *
 * A hold taken while a restore is still owed keeps the earlier original, not
 * the raised value the device reports now. Otherwise a drop and a re-entry
 * would "restore" the device to the raised value.
 *
 * The Motion Detection stream raises op8 the same way for its test window but
 * keeps the original in a ref, so a drop there leaves the device raised. It
 * predates this module.
 */
class KeepAwake {
    private holdsByDevice: Map<string, Hold> = new Map()
    /** Restores owed, by device: the original op8 while a raise is in effect */
    private owedByDevice: Map<string, number> = new Map()

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.DISCONNECT && this.holdsByDevice.delete(event.deviceId)) {
                // The hold cannot be released over a dead link. Whatever is owed
                // stays owed and is written back on the next connection.
                log(`[KeepAwake] link to ${event.deviceId} dropped with a hold active; restore deferred to the next connection`)
            }
        })
    }

    /** True while a hold is active: the device stays awake `holdMs` after its last activity. */
    public holds(deviceId: string): boolean {
        return this.holdsByDevice.has(deviceId)
    }

    /**
     * Raise op8 to `holdMs` unless it is already at least that, and remember
     * what to put back. Idempotent: a second call while a hold is active does
     * nothing.
     *
     * @returns true when a hold is active afterwards; false when op8 could not
     *          be read, in which case nothing was written.
     */
    public async acquire(session: KeepAwakeSession, deviceId: string, holdMs: number = DEFAULT_HOLD_MS): Promise<boolean> {
        if (this.holdsByDevice.has(deviceId)) return true

        const owed = await this.owed(deviceId)
        const ops = await session.getOps()
        const current = parseInt(ops?.[OP_PARAMETER.INTERVAL_BEFORE_DPD] ?? '', 10)
        if (isNaN(current)) {
            logWarn(`[KeepAwake] op8 not readable on ${deviceId}; not holding it awake`)
            return false
        }

        // An owed original only applies while our raise is still in effect. If
        // the device now reads below the hold, something else (a deployment,
        // a reset, a console command) has set op8 since, and that value is the
        // one to go back to.
        const originalDpd = owed !== null && current >= holdMs ? owed : current

        // Write the hold when the device sleeps sooner than it, and also when it
        // sleeps later because of an earlier raise of ours that asked for more
        // (an owed original means the value on the device is ours). A larger
        // value someone else chose is left alone.
        const write = current < holdMs || (owed !== null && current > holdMs)
        if (write) {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: holdMs }))
        }

        // Something to put back only if the device now differs from its original.
        const onDevice = write ? holdMs : current
        const raised = onDevice !== originalDpd
        this.holdsByDevice.set(deviceId, { originalDpd, raised })
        if (raised) {
            await this.setOwed(deviceId, originalDpd)
            log(`[KeepAwake] holding ${deviceId} awake: op8 ${originalDpd} -> ${onDevice}`)
        } else {
            await this.clearOwed(deviceId)
            log(`[KeepAwake] holding ${deviceId} awake: op8 at ${onDevice}, nothing to put back`)
        }
        return true
    }

    /**
     * Put op8 back. Safe to call without a hold. If the write fails, the
     * restore stays owed and `restorePending` completes it later.
     */
    public async release(session: KeepAwakeSession, deviceId: string): Promise<void> {
        const hold = this.holdsByDevice.get(deviceId)
        if (!hold) return
        this.holdsByDevice.delete(deviceId)
        if (!hold.raised) return
        await this.writeBack(session, deviceId, hold.originalDpd, 'release')
    }

    /**
     * Write back a restore that an earlier drop or app restart left owed.
     * Nothing happens when nothing is owed, or while a hold is active (its
     * release will do the restore). For a flow to call on entry; never from
     * the connect path, which must not write to the device.
     */
    public async restorePending(session: KeepAwakeSession, deviceId: string): Promise<void> {
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

    private async writeBack(session: KeepAwakeSession, deviceId: string, value: number, why: string): Promise<void> {
        try {
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value }))
            await this.clearOwed(deviceId)
            log(`[KeepAwake] op8 on ${deviceId} restored to ${value} (${why})`)
        } catch (e) {
            logWarn(`[KeepAwake] could not restore op8 on ${deviceId} to ${value} (${why}); will retry on the next connection:`, e)
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
            logWarn('[KeepAwake] could not clear the stored restore:', e)
        }
    }
}

/** Module-level singleton, shared by every session. */
export const keepAwake = new KeepAwake()
