/**
 * Whether the Bluetooth update waits for the AI processor's (#527): it is not
 * offered while the AI processor has an update waiting, unless that AI update
 * is already half done.
 *
 * Seeed PR 284 and ww-hardware PR 77 change how the two processors signal
 * each other, and a camera with old AI and new Bluetooth takes no file, so the
 * AI update could not run after the Bluetooth one. The AI update goes first:
 * it installs image 1 and restarts into it, then image 2 cannot go across with
 * the old Bluetooth, and the update stops half done. The Bluetooth update
 * needs no AI processor, so it is offered then, and Finish update writes
 * image 2 with both new. Firmware Status and Start Monitoring's firmware check
 * both ask this.
 */
export const bleUpdateWaits = (statuses: Record<'ble' | 'himax', { isOutdated: boolean; unfinished?: unknown }>): boolean =>
    statuses.ble.isOutdated && statuses.himax.isOutdated && !statuses.himax.unfinished
