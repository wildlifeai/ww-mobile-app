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
import { createBleSession } from '../../session/createBleSession'
import { commandRegistry } from '../commandRegistry'
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
import { log, logError, logWarn } from '../../../utils/logger'

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

    // ── Phase 0: AI READINESS CHECK ─────────────────────────────────
    // The AI processor must be in AI_STATE_IDLE to accept file packets.
    // If it's in SLEEP, FILE_START is silently dropped (UNHANDLED event).
    // Sending a text command ('AI ver') wakes the processor through the
    // firmware's existing wake-and-defer mechanism, guaranteeing IDLE
    // state before the binary transfer begins.
    emitProgress('checking')
    log(`[FileTransfer] Ensuring AI processor is awake...`)
    try {
      // Release the transport lock temporarily so the text command can run
      transportLock.release(transferId)
      bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: false, ts: Date.now() })

      const session = createBleSession(peripheral)
      const aiVersion = await session.execute(() => commandRegistry.aiver())
      log(`[FileTransfer] AI processor ready (version: ${aiVersion})`)

      // Re-acquire lock for the binary transfer
      if (commandQueue.isBusy()) {
        throw new FileTransferError('VALIDATION_FAILED', 'Another command started while preparing transfer')
      }
      transportLock.acquire(transferId)
      bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: true, ts: Date.now() })
    } catch (err: any) {
      // If the readiness check fails, the AI processor is unreachable.
      // This is fatal — don't proceed with the transfer.
      if (err instanceof FileTransferError) throw err
      logWarn(`[FileTransfer] AI readiness check failed: ${err.message}`)
      throw new FileTransferError(
        'VALIDATION_FAILED',
        `AI processor not responding. Ensure the device is powered and nearby. (${err.message})`,
      )
    }

    // Start silence monitoring
    bleEventBus.on('textLine', silenceHandler)
    resetSilenceTimer()

    // ── Phase 1: FILE_START ────────────────────────────────────────
    emitProgress('starting')
    const startPacket = buildFileStartPacket(filename, data.length)

    // Register ACK listener BEFORE sending — the device can respond
    // faster than writeBinaryToDevice resolves on the JS side.
    const startAckPromise = prepareAckWait({ phase: 'start' }, FILE_START_ACK_TIMEOUT_MS)
    await writeBinaryToDevice(peripheral, startPacket, true)
    log(`[FileTransfer] FILE_START sent: ${filename} (${data.length} bytes)`)

    await startAckPromise
    log(`[FileTransfer] FILE_START ACKed`)

    // ── Phase 2: FILE_DATA ─────────────────────────────────────────
    emitProgress('transferring')
    let consecutiveTimeouts = 0

    for (let offset = 0; offset < data.length; offset += MAX_PAYLOAD_BYTES) {
      // Check abort before each packet
      if (abortSignal?.aborted) {
        throw new FileTransferError('ABORTED', 'Transfer cancelled by user')
      }

      const chunkEnd = Math.min(offset + MAX_PAYLOAD_BYTES, data.length)
      const chunk = data.slice(offset, chunkEnd)
      wirePacketNum = nextWirePacketNum(wirePacketNum)

      if (wirePacketNum === 1 && packetsAcked > 0) {
        wrapCycles++
        log(`[FileTransfer] Packet number wrapped 255→1 (cycle ${wrapCycles})`)
      }

      const dataPacket = buildFileDataPacket(wirePacketNum, chunk)

      // Retry loop for this single packet
      let packetAcked = false
      while (!packetAcked) {
        try {
          const ackStartTime = Date.now()
          const dataAckPromise = prepareAckWait({ phase: 'data', packetNum: wirePacketNum })
          await writeBinaryToDevice(peripheral, dataPacket, false)
          await dataAckPromise

          // Success — track timing for ETA
          ackTimes.push(Date.now() - ackStartTime)
          consecutiveTimeouts = 0
          packetAcked = true
        } catch (err: any) {
          // Classify: is this a timeout we can retry?
          const isTimeout =
            err instanceof StreamTimeoutError ||
            (err instanceof FileTransferError && err.reason === 'ACK_TIMEOUT')

          if (!isTimeout) {
            // Non-timeout errors (disconnect, abort, device error) are fatal
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
      emitProgress('transferring')
    }

    // ── Phase 3: FILE_END ──────────────────────────────────────────
    emitProgress('verifying')
    const endPacket = buildFileEndPacket(crc)
    
    const endAckPromise = prepareAckWait({ phase: 'end' })
    await writeBinaryToDevice(peripheral, endPacket, true) // write with response
    log(`[FileTransfer] FILE_END sent: CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')}`)

    await endAckPromise
    log(`[FileTransfer] Transfer complete: "ftx done" received`)

    // ── Success ────────────────────────────────────────────────────
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
