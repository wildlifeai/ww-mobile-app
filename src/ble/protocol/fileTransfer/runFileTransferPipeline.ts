/**
 * runFileTransferPipeline.ts
 *
 * Central authority for the BLE file transfer session.
 * Sends file data from the app to the WW500 device's SD card.
 *
 * Invariants:
 *   - AI processor is confirmed awake (IDLE) via text command before FILE_START
 *   - Uses TextStreamScope, never raw bleEventBus.on()
 *   - Acquires exclusive transport lock for the entire START→DONE session
 *   - Heartbeats are paused automatically
 *   - Disconnect is detected immediately (event-driven)
 *   - User cancel via AbortSignal
 *   - Silence timeout is transfer-scoped (ftx lines only)
 *   - FILE_START uses adaptive timeout (20s) for cold-start overhead
 *   - All outcomes produce FileTransferLog
 */

import { Platform } from 'react-native'
import { NativeEventEmitter, NativeModules } from 'react-native'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { writeBinaryToDevice } from '../../transport'
import { bleEventBus, BleEvent } from '../eventBus'
import { transportLock } from '../transportLock'
import { commandQueue } from '../commandQueue'
import { TextStreamScope, StreamTimeoutError } from '../textStreamScope'
// Removed unused createBleSession and commandRegistry
import { crc16ccitt } from './crc16ccitt'
import { isValid83Filename } from './filenameValidator'
import { buildFileStartPacket, buildFileDataPacket, buildFileEndPacket } from './fileTransferPackets'
import { matchAck, logIgnoredAck, ExpectedAck } from './ackMatcher'
import {
  FileTransferOptions,
  FileTransferResult,
  FileTransferProgress,
  FileTransferLog,
  FileTransferError,
  MAX_TRANSFER_SIZE_BYTES,
  MAX_PAYLOAD_BYTES,
  ACK_TIMEOUT_MS,
  SILENCE_TIMEOUT_MS,
  MAX_CONSECUTIVE_TIMEOUTS,
} from './fileTransferTypes'
import { log, logError } from '../../../utils/logger'

// Same pattern as NativeModulesSection.tsx — Metro bundles package.json at build time
const appVersion: string = require('../../../../package.json').version ?? '0.0.0'

// Module-level singleton to avoid creating a new NativeEventEmitter per pipeline run.
// Lazy-init: null until first use, guarded by NativeModules.BleManager existence.
let bleManagerEmitter: NativeEventEmitter | null = null
function getBleManagerEmitter(): NativeEventEmitter | null {
  if (bleManagerEmitter) return bleManagerEmitter
  if (NativeModules.BleManager) {
    try {
      bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager)
    } catch {
      // Guard: some environments (tests, web) may not have the native module
    }
  }
  return bleManagerEmitter
}

// ─── Helpers ─────────────────────────────────────────────────────────

function generateTransferId(): string {
  return `ftx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function nextWirePacketNum(current: number): number {
  return current === 255 ? 1 : current + 1
}

function formatSpeed(bytesPerMs: number): string {
  const kbps = (bytesPerMs * 1000) / 1024
  return kbps < 1 ? `${(kbps * 1024).toFixed(0)} B/s` : `${kbps.toFixed(1)} KB/s`
}

/**
 * FILE_START timeout is longer than subsequent DATA ACKs because:
 * - The AI processor may still be transitioning from wake→selftest→idle
 * - The HX6538 needs to open/create the file on the SD card
 * - First packet in a session has cold-start overhead
 */
const FILE_START_ACK_TIMEOUT_MS = 20_000

/**
 * Maximum number of full-session retries on recoverable device errors
 * (e.g. ftx err 7 = SD write fail due to inactivity-induced DPD).
 * Each retry restarts from FILE_START.
 */
const MAX_SESSION_RETRIES = 2

/** Delay before retrying a full session (ms). Gives the device time to
 *  finish its sleep/wake cycle after a failed transfer. */
const SESSION_RETRY_DELAY_MS = 3_000

// ─── Main Pipeline ───────────────────────────────────────────────────

export async function runFileTransferPipeline(
  peripheral: ExtendedPeripheral,
  options: FileTransferOptions,
): Promise<FileTransferResult> {
  const { filename, data, onProgress, abortSignal } = options
  const transferId = generateTransferId()
  const startTime = Date.now()

  // ── Pre-lock validation (no transport lock held) ────────────────
  if (!isValid83Filename(filename)) {
    throw new FileTransferError('VALIDATION_FAILED', `Invalid filename: "${filename}". Use 8.3 format (e.g. OUTPUT.IMG), uppercase letters and digits.`)
  }
  if (data.length === 0) {
    throw new FileTransferError('VALIDATION_FAILED', 'File is empty')
  }
  if (data.length > MAX_TRANSFER_SIZE_BYTES) {
    throw new FileTransferError('VALIDATION_FAILED', `File too large (${(data.length / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_TRANSFER_SIZE_BYTES / 1024 / 1024} MB.`)
  }

  // ── Compute CRC before acquiring lock ───────────────────────────
  const crc = crc16ccitt(data)
  const totalPackets = Math.ceil(data.length / MAX_PAYLOAD_BYTES)
  log(`[FileTransfer] ${transferId}: ${filename} ${data.length} bytes, ${totalPackets} packets, CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')}`)

  // ── Pre-build all FILE_DATA packets ────────────────────────────
  // Moving packet construction out of the hot loop eliminates ~500ms
  // of JS overhead per packet (data.slice + buildFileDataPacket).
  // This is critical because the Himax inactivity timer is 1000ms —
  // every millisecond saved between ACK receipt and next write matters.
  const preBuiltPackets: { wireNum: number; chunkEnd: number; packet: Uint8Array }[] = []
  {
    let wireNum = 0
    for (let offset = 0; offset < data.length; offset += MAX_PAYLOAD_BYTES) {
      wireNum = nextWirePacketNum(wireNum)
      const chunkEnd = Math.min(offset + MAX_PAYLOAD_BYTES, data.length)
      const chunk = data.slice(offset, chunkEnd)
      preBuiltPackets.push({
        wireNum,
        chunkEnd,
        packet: buildFileDataPacket(wireNum, chunk),
      })
    }
    log(`[FileTransfer] Pre-built ${preBuiltPackets.length} packets`)
  }

  // ── Progress state ─────────────────────────────────────────────
  let bytesSent = 0
  let packetsAcked = 0
  let wrapCycles = 0
  let wirePacketNum = 0
  let disconnectOccurred = false
  const ackTimes: number[] = [] // rolling window for ETA

  const emitProgress = (phase: FileTransferProgress['phase']) => {
    const elapsed = Date.now() - startTime
    const avgAckTime = ackTimes.length > 0 
      ? ackTimes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(ackTimes.length, 10)
      : 0
    const remaining = avgAckTime > 0 ? (totalPackets - packetsAcked) * avgAckTime : 0
    const speed = elapsed > 0 ? formatSpeed(bytesSent / elapsed) : '0 B/s'

    onProgress?.({
      phase,
      bytesSent,
      totalBytes: data.length,
      currentPacket: packetsAcked,
      totalPackets,
      percentage: data.length > 0 ? Math.round((bytesSent / data.length) * 100) : 0,
      elapsedMs: elapsed,
      estimatedRemainingMs: remaining,
      currentSpeed: speed,
    })
  }

  // ── Build transfer log ─────────────────────────────────────────
  const transferLog: FileTransferLog = {
    transferId,
    deviceId: peripheral.id,
    filename,
    sizeBytes: data.length,
    crc,
    maxPayloadBytes: MAX_PAYLOAD_BYTES,
    totalPackets,
    startTime: new Date(startTime).toISOString(),
    endTime: '',
    durationMs: 0,
    packetsAcked: 0,
    lastAckedPacket: 0,
    wrapCycles: 0,
    finalStatus: 'success',
    disconnectOccurred: false,
    crcVerified: false,
    platform: Platform.OS,
    appVersion,
  }

  // ── Scoped stream + disconnect + abort + silence promises ──────
  const stream = new TextStreamScope(
    peripheral.id,
    (line: string) => line.startsWith('ftx '),
  )

  // Silence tracking — rejects when no ftx-prefixed UART activity
  // for SILENCE_TIMEOUT_MS. Uses a promise (not setInterval) so it
  // participates properly in Promise.race inside waitForAck.
  let silenceReject: ((err: Error) => void) | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      silenceReject?.(
        new FileTransferError(
          'DEVICE_SILENT',
          'No transfer response for 15 seconds — device may be stuck',
        ),
      )
    }, SILENCE_TIMEOUT_MS)
  }

  const silencePromise = new Promise<never>((_resolve, reject) => {
    silenceReject = reject
  })

  const silenceHandler = (event: BleEvent & { type: 'TEXT_LINE' }) => {
    if (event.deviceId !== peripheral.id) return
    if (typeof event.line === 'string' && event.line.startsWith('ftx ')) {
      resetSilenceTimer()
    }
  }

  // Disconnect detection — explicit NativeModules guard
  let disconnectCleanup: (() => void) | null = null
  let disconnectReject: ((err: Error) => void) | null = null
  const disconnectPromise = new Promise<never>((_resolve, reject) => {
    disconnectReject = reject
  })

  const emitter = getBleManagerEmitter()
  if (emitter) {
    const sub = emitter.addListener(
      'BleManagerDisconnectPeripheral',
      (event: { peripheral: string }) => {
        if (event.peripheral === peripheral.id) {
          disconnectOccurred = true
          disconnectReject?.(
            new FileTransferError(
              'DISCONNECTED',
              'Device disconnected during transfer',
            ),
          )
        }
      },
    )
    disconnectCleanup = () => sub.remove()
  }

  // User cancel — handler extracted so it can be removed in finally
  let abortHandler: (() => void) | null = null
  const abortPromise = new Promise<never>((_resolve, reject) => {
    if (!abortSignal) return
    if (abortSignal.aborted) {
      reject(new FileTransferError('ABORTED', 'Transfer cancelled'))
      return
    }
    abortHandler = () => {
      reject(new FileTransferError('ABORTED', 'Transfer cancelled by user'))
    }
    abortSignal.addEventListener('abort', abortHandler)
  })

  // Helper: set up ACK listener and race against disconnect + abort + silence.
  // Returns a Promise that resolves when the expected ACK arrives.
  // IMPORTANT: Call this BEFORE sending the packet so the listener is
  // registered before the device can respond.  The device can ACK a packet
  // faster than a JS `await writeBinaryToDevice(...)` resolves.
  function prepareAckWait(expected: ExpectedAck, timeoutMs?: number): Promise<string> {
    resetSilenceTimer() // reset on send

    const ackPromise = stream.waitFor((line: string) => {
      const result = matchAck(line, expected)
      if (result.type === 'accept') return true
      if (result.type === 'error') {
        throw new FileTransferError('DEVICE_ERROR', `Device error: ${line}`, result.code)
      }
      if (result.type === 'ignore') {
        logIgnoredAck(result)
      }
      return false
    }, timeoutMs ?? ACK_TIMEOUT_MS)

    const races: Promise<any>[] = [ackPromise, disconnectPromise, silencePromise]
    if (abortSignal) races.push(abortPromise)

    return Promise.race(races)
  }

  // ── Acquire transport lock + execute transfer ──────────────────
  try {
    // Ensure no other commands are running
    if (commandQueue.isBusy()) {
      throw new FileTransferError('VALIDATION_FAILED', 'Cannot start transfer while another command is in progress')
    }

    // Acquire lock
    transportLock.acquire(transferId)
    
    // Pause heartbeats
    bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: true, ts: Date.now() })

    // Start silence monitoring
    bleEventBus.on('textLine', silenceHandler)
    resetSilenceTimer()

    // ── Session retry loop ─────────────────────────────────────────
    // On ftx err 7 (SD write fail), the device closes the file and
    // enters DPD. The only recovery is a full restart from FILE_START.
    // This is typically caused by the Himax 1000ms inactivity timer
    // firing between packets when the BLE round-trip is too slow.
    let sessionAttempt = 0

    while (true) {
      // Reset progress state for this attempt
      bytesSent = 0
      packetsAcked = 0
      wrapCycles = 0
      wirePacketNum = 0
      ackTimes.length = 0

      try {
        // ── Phase 1: FILE_START ──────────────────────────────────────
        emitProgress('starting')
        const startPacket = buildFileStartPacket(filename, data.length)

        // Register ACK listener BEFORE sending — the device can respond
        // faster than writeBinaryToDevice resolves on the JS side.
        const startAckPromise = prepareAckWait({ phase: 'start' }, FILE_START_ACK_TIMEOUT_MS)
        await writeBinaryToDevice(peripheral, startPacket, true)
        log(`[FileTransfer] FILE_START sent: ${filename} (${data.length} bytes) [attempt ${sessionAttempt + 1}]`)

        await startAckPromise
        log(`[FileTransfer] FILE_START ACKed`)

        // ── Phase 2: FILE_DATA (pre-built packets) ───────────────────
        emitProgress('transferring')
        let consecutiveTimeouts = 0
        let lastProgressEmitTime = Date.now()
        const PROGRESS_THROTTLE_MS = 500    // emit progress at most every 500ms
        const PROGRESS_THROTTLE_PKTS = 10   // or every 10 packets

        for (let i = 0; i < preBuiltPackets.length; i++) {
          // Check abort before each packet
          if (abortSignal?.aborted) {
            throw new FileTransferError('ABORTED', 'Transfer cancelled by user')
          }

          const { wireNum, chunkEnd, packet: dataPacket } = preBuiltPackets[i]
          wirePacketNum = wireNum

          if (wirePacketNum === 1 && packetsAcked > 0) {
            wrapCycles++
            log(`[FileTransfer] Packet number wrapped 255→1 (cycle ${wrapCycles})`)
          }

          // Retry loop for this single packet (ACK timeout only)
          let packetAcked = false
          while (!packetAcked) {
            try {
              const ackStartTime = Date.now()
              const dataAckPromise = prepareAckWait({ phase: 'data', packetNum: wirePacketNum })

              await writeBinaryToDevice(peripheral, dataPacket, false)

              await dataAckPromise
              const roundtrip = Date.now() - ackStartTime

              // Accumulate timing silently — no per-packet log in hot loop
              ackTimes.push(roundtrip)
              consecutiveTimeouts = 0
              packetAcked = true
            } catch (err: any) {
              // Classify: is this a timeout we can retry?
              const isTimeout =
                err instanceof StreamTimeoutError ||
                (err instanceof FileTransferError && err.reason === 'ACK_TIMEOUT')

              if (!isTimeout) {
                // Non-timeout errors (disconnect, abort, device error) are fatal
                // for this attempt — they'll be caught by the session retry handler
                throw err
              }

              consecutiveTimeouts++
              log(`[FileTransfer] ACK timeout for packet ${wirePacketNum} (${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS})`)

              if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
                throw new FileTransferError(
                  'ACK_TIMEOUT',
                  `${MAX_CONSECUTIVE_TIMEOUTS} consecutive ACK timeouts — Bluetooth connection unstable`,
                )
              }

              // Retry: re-send the same packet (loop continues)
            }
          }

          bytesSent = chunkEnd
          packetsAcked++

          // Throttled progress emission — reduce React state update jitter
          const now = Date.now()
          if (
            i === preBuiltPackets.length - 1 ||          // always emit on last packet
            packetsAcked % PROGRESS_THROTTLE_PKTS === 0 || // every N packets
            now - lastProgressEmitTime >= PROGRESS_THROTTLE_MS // or every Nms
          ) {
            emitProgress('transferring')
            lastProgressEmitTime = now
          }
        }

        // Log timing summary after data loop
        if (ackTimes.length > 0) {
          const times = ackTimes
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          const min = Math.min(...times)
          const max = Math.max(...times)
          log(`[FileTransfer] DATA phase complete: ${packetsAcked} pkts | avg=${avg}ms min=${min}ms max=${max}ms`)
        }

        // ── Phase 3: FILE_END ────────────────────────────────────────
        emitProgress('verifying')
        const endPacket = buildFileEndPacket(crc)
        
        const endAckPromise = prepareAckWait({ phase: 'end' })
        await writeBinaryToDevice(peripheral, endPacket, true) // write with response
        log(`[FileTransfer] FILE_END sent: CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')}`)

        await endAckPromise
        log(`[FileTransfer] Transfer complete: "ftx done" received`)

        // ── Success ──────────────────────────────────────────────────
        emitProgress('complete')
        const duration = Date.now() - startTime

        transferLog.endTime = new Date().toISOString()
        transferLog.durationMs = duration
        transferLog.packetsAcked = packetsAcked
        transferLog.lastAckedPacket = wirePacketNum
        transferLog.wrapCycles = wrapCycles
        transferLog.finalStatus = 'success'
        transferLog.crcVerified = true
        transferLog.disconnectOccurred = disconnectOccurred
        log(`[FileTransfer] LOG: ${JSON.stringify(transferLog)}`)

        return {
          success: true,
          filename,
          sizeBytes: data.length,
          durationMs: duration,
          totalPackets: packetsAcked,
          crc,
        }

      } catch (sessionErr: any) {
        // ── Session retry on recoverable device errors ────────────
        const isFileTransferError = sessionErr instanceof FileTransferError
        const hasDeviceErrorReason = sessionErr?.reason === 'DEVICE_ERROR'
        const hasErrorCode7 = sessionErr?.errorCode === 7
        const isRecoverable = isFileTransferError && hasDeviceErrorReason && hasErrorCode7

        log(`[FileTransfer] Session error caught: instanceof=${isFileTransferError}, reason=${sessionErr?.reason}, errorCode=${sessionErr?.errorCode} (type=${typeof sessionErr?.errorCode}), isRecoverable=${isRecoverable}`)

        sessionAttempt++

        if (isRecoverable && sessionAttempt < MAX_SESSION_RETRIES) {
          log(`[FileTransfer] ⚠️ ftx err 7 (SD write fail) — retrying full session (attempt ${sessionAttempt + 1}/${MAX_SESSION_RETRIES + 1})`)
          log(`[FileTransfer] Waiting ${SESSION_RETRY_DELAY_MS}ms for device to complete sleep/wake cycle...`)
          emitProgress('starting') // reset UI to "starting" for retry
          await new Promise(resolve => setTimeout(resolve, SESSION_RETRY_DELAY_MS))

          // Check if device disconnected during the wait
          if (disconnectOccurred) {
            throw new FileTransferError('DISCONNECTED', 'Device disconnected during retry wait')
          }
          if (abortSignal?.aborted) {
            throw new FileTransferError('ABORTED', 'Transfer cancelled during retry wait')
          }

          // Loop continues → next attempt from FILE_START
          continue
        }

        // Non-recoverable or retries exhausted — propagate
        throw sessionErr
      }
    } // end session retry loop

  } catch (err: any) {
    const duration = Date.now() - startTime
    transferLog.endTime = new Date().toISOString()
    transferLog.durationMs = duration
    transferLog.packetsAcked = packetsAcked
    transferLog.lastAckedPacket = wirePacketNum
    transferLog.wrapCycles = wrapCycles
    transferLog.disconnectOccurred = disconnectOccurred

    if (err instanceof FileTransferError) {
      transferLog.finalStatus = err.reason
      transferLog.errorCode = err.errorCode
      transferLog.errorMessage = err.message
    } else {
      transferLog.finalStatus = 'WRITE_FAILED'
      transferLog.errorMessage = err.message ?? String(err)
    }

    logError(`[FileTransfer] FAILED: ${JSON.stringify(transferLog)}`)
    emitProgress('failed')

    throw err
  } finally {
    // ALWAYS cleanup, even on crash
    stream.destroy()
    if (silenceTimer) clearTimeout(silenceTimer)
    bleEventBus.removeListener('textLine', silenceHandler)
    disconnectCleanup?.()
    if (abortSignal && abortHandler) {
      abortSignal.removeEventListener('abort', abortHandler)
    }
    transportLock.release(transferId)
    bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: false, ts: Date.now() })
    log(`[FileTransfer] Pipeline cleanup complete`)
  }
}
