/**
 * bleFirmwareFloor.ts
 *
 * The oldest BLE (nRF) firmware a streamed file transfer works against, and
 * the check that keeps a transfer off anything older (#289).
 */

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { bleTransport } from '../bleTransportController'
import { runCommandPipeline } from '../runCommandPipeline'
import { BleFirmwareVersion, commandRegistry, parseBleFirmwareVersion } from '../commandRegistry'
import { log, logWarn } from '../../../utils/logger'

/**
 * The floor: 0.30.47 is the first BLE firmware with the 16-slot relay FIFO
 * and cumulative acks (ww-hardware #27).
 *
 * Older builds have one relay slot. A packet that arrives while it is full is
 * dropped with a log line on the nRF console and no `ftx err` to the app, and
 * one that arrives during a relay resets their AI state machine to SLEEP, so
 * the ack in flight is lost too. A windowed transfer then hangs until the
 * silence timeout. Stop-and-wait would suit them, but it stalls on 0.30.47
 * and later, which ack every 4th packet, so the app refuses rather than
 * falling back.
 *
 * runFileTransferPipeline.ts and File-Transfer-Protocol.md cite this constant.
 * Change the floor here and nowhere else.
 */
export const MIN_BLE_FIRMWARE_FOR_TRANSFER = '0.30.47'

export type BleFirmwareCheck =
  | { verdict: 'supported'; version: string }
  | { verdict: 'too_old'; version: string }
  | { verdict: 'unknown' }

const FLOOR = parseBleFirmwareVersion(MIN_BLE_FIRMWARE_FOR_TRANSFER) as BleFirmwareVersion

function compareVersions(a: BleFirmwareVersion, b: BleFirmwareVersion): number {
  return (a.major - b.major) || (a.minor - b.minor) || (a.patch - b.patch)
}

/** `0.30.51`, the form the cloud's `ble` rows use, whatever padding the device sent. */
function formatVersion(v: BleFirmwareVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

/** The verdict on one reading. None, or one that does not parse, is unknown: never a pass, never a refusal. */
export function judgeBleFirmware(reading: string | null | undefined): BleFirmwareCheck {
  const version = parseBleFirmwareVersion(reading)
  if (!version) return { verdict: 'unknown' }
  return compareVersions(version, FLOOR) >= 0
    ? { verdict: 'supported', version: formatVersion(version) }
    : { verdict: 'too_old', version: formatVersion(version) }
}

/**
 * One `ver`, no retry. Null when the camera does not answer, the link is down
 * or the caller cancels: the caller decides what an unknown version means.
 */
async function readBleFirmwareVersion(
  peripheral: ExtendedPeripheral,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!peripheral.connected) return null
  try {
    return await bleTransport.enqueue<string>(
      (taskSignal) => runCommandPipeline(peripheral, commandRegistry.version, { maxRetries: 0, signal: taskSignal }),
      { signal },
    )
  } catch (e: any) {
    logWarn(`[FileTransfer] No answer to ver: ${e?.message ?? e}`)
    return null
  }
}

/**
 * Whether the camera's BLE firmware can take a streamed transfer, for one
 * `ver` at most.
 *
 * A reading from the caller that clears the floor is trusted and nothing is
 * sent. Anything else (no reading, one that does not parse, one below the
 * floor) is checked with one `ver`. A reading from before a BLE firmware
 * update is stale: Start Monitoring keeps the one from its pre-deployment
 * checks across an update made from that screen, and refusing on it would
 * send the operator to update firmware they have just updated. When `ver`
 * gets no answer the caller's reading stands, and without one the verdict is
 * unknown.
 */
export async function checkBleFirmwareForTransfer(
  peripheral: ExtendedPeripheral,
  known: string | null | undefined,
  signal?: AbortSignal,
): Promise<BleFirmwareCheck> {
  const floor = `floor ${MIN_BLE_FIRMWARE_FOR_TRANSFER}`
  const given = judgeBleFirmware(known)
  if (given.verdict === 'supported') {
    log(`[FileTransfer] BLE firmware ${given.version} (caller's reading), ${floor}`)
    return given
  }

  const fresh = judgeBleFirmware(await readBleFirmwareVersion(peripheral, signal))
  if (fresh.verdict !== 'unknown') {
    log(`[FileTransfer] BLE firmware ${fresh.version} (ver), ${floor}`)
    return fresh
  }
  if (given.verdict === 'too_old') {
    log(`[FileTransfer] BLE firmware ${given.version} (caller's reading, ver unanswered), ${floor}`)
    return given
  }
  log(`[FileTransfer] BLE firmware unknown (ver unanswered), ${floor}: streaming anyway`)
  return { verdict: 'unknown' }
}

/** The refusal, before anything is sent. */
export function bleFirmwareTooOldMessage(version: string): string {
  return `This camera's BLE firmware is ${version}, and sending files to it needs ${MIN_BLE_FIRMWARE_FOR_TRANSFER} or later. ` +
    'Update the BLE firmware first, then try again.'
}

/**
 * The silence timeout when the version could not be read and the camera went
 * quiet before acknowledging a window's worth of packets: how firmware below
 * the floor fails, so the message says so instead of "device may be stuck".
 */
export function silenceOnUnknownFirmwareMessage(packetsAcked: number, packetsSent: number): string {
  const heard = packetsAcked === 0
    ? `acknowledged none of the ${packetsSent} packets sent`
    : `acknowledged ${packetsAcked} of the ${packetsSent} packets sent`
  return `The camera ${heard}, then went silent. Its BLE firmware version could not be read, ` +
    `and it may be older than ${MIN_BLE_FIRMWARE_FOR_TRANSFER}, which does not support streamed transfers. ` +
    'If it is, update the BLE firmware, then try again.'
}
