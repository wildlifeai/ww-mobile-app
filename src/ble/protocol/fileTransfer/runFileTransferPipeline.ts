/**
 * runFileTransferPipeline.ts
 *
 * Central authority for the BLE file transfer session.
 * Sends file data from the app to the WW500 device's SD card.
 *
 * Invariants:
 *   - Uses TextStreamScope, never raw bleEventBus.on()
 *   - Acquires exclusive transport lock for the entire START→DONE session
 *   - Heartbeats are paused automatically
 *   - Disconnect is detected immediately (event-driven)
 *   - User cancel via AbortSignal
 *   - Silence timeout is transfer-scoped (ftx lines only)
 *   - All outcomes produce FileTransferLog
 */

import { Platform } from 'react-native'
import { NativeEventEmitter, NativeModules } from 'react-native'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { writeBinaryToDevice } from '../../transport'
import { bleEventBus, BleEvent } from '../eventBus'
import { transportLock } from '../transportLock'
import { TextStreamScope } from '../textStreamScope'
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
    appVersion: '1.0.0', // TODO: read from app config
  }

  // ── Scoped stream + disconnect + abort promises ────────────────
  const stream = new TextStreamScope(
    peripheral.id,
    (line: string) => line.startsWith('ftx '),
  )

  // Silence tracking — only ftx lines reset the timer
  let lastTransferActivityTs = Date.now()
  let silenceChecker: ReturnType<typeof setInterval> | null = null
  const silenceHandler = (event: BleEvent & { type: 'TEXT_LINE' }) => {
    if (event.deviceId !== peripheral.id) return
    if (typeof event.line === 'string' && event.line.startsWith('ftx ')) {
      lastTransferActivityTs = Date.now()
    }
  }

  // Disconnect detection
  let disconnectCleanup: (() => void) | null = null
  let disconnectReject: ((err: Error) => void) | null = null
  const disconnectPromise = new Promise<never>((_resolve, reject) => {
    disconnectReject = reject
  })

  // Setup native listener separately so cleanup ref is always assigned
  try {
    const emitter = new NativeEventEmitter(NativeModules.BleManager)
    const sub = emitter.addListener('BleManagerDisconnectPeripheral', (event: { peripheral: string }) => {
      if (event.peripheral === peripheral.id) {
        disconnectOccurred = true
        disconnectReject?.(new FileTransferError('DISCONNECTED', 'Device disconnected during transfer'))
      }
    })
    disconnectCleanup = () => sub.remove()
  } catch {
    // In test environment, NativeModules may not be available
  }

  // User cancel
  const abortPromise = new Promise<never>((_resolve, reject) => {
    if (!abortSignal) return
    if (abortSignal.aborted) {
      reject(new FileTransferError('ABORTED', 'Transfer cancelled'))
      return
    }
    abortSignal.addEventListener('abort', () => {
      reject(new FileTransferError('ABORTED', 'Transfer cancelled by user'))
    })
  })

  // Helper: race ACK wait against disconnect + abort + silence
  async function waitForAck(expected: ExpectedAck): Promise<string> {
    lastTransferActivityTs = Date.now() // reset on send

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
    }, ACK_TIMEOUT_MS)

    const races: Promise<any>[] = [ackPromise, disconnectPromise]
    if (abortSignal) races.push(abortPromise)

    return Promise.race(races)
  }

  // ── Acquire transport lock + execute transfer ──────────────────
  try {
    // Acquire lock
    transportLock.acquire(transferId)
    
    // Pause heartbeats
    bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: true, ts: Date.now() })

    // Start silence monitoring
    bleEventBus.on('textLine', silenceHandler)
    silenceChecker = setInterval(() => {
      if (Date.now() - lastTransferActivityTs > SILENCE_TIMEOUT_MS) {
        throw new FileTransferError('DEVICE_SILENT', 'No transfer response for 15 seconds — device may be stuck')
      }
    }, 1000)

    // ── Phase 1: FILE_START ────────────────────────────────────────
    emitProgress('starting')
    const startPacket = buildFileStartPacket(filename, data.length)
    await writeBinaryToDevice(peripheral, startPacket, true) // write with response
    log(`[FileTransfer] FILE_START sent: ${filename} (${data.length} bytes)`)

    await waitForAck({ phase: 'start' })
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

      try {
        await writeBinaryToDevice(peripheral, dataPacket, false) // write without response
        const ackStartTime = Date.now()
        await waitForAck({ phase: 'data', packetNum: wirePacketNum })

        // Track timing for ETA
        ackTimes.push(Date.now() - ackStartTime)
        consecutiveTimeouts = 0
      } catch (err: any) {
        if (err instanceof FileTransferError && err.reason === 'ACK_TIMEOUT') {
          consecutiveTimeouts++
          if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
            throw new FileTransferError('ACK_TIMEOUT', `${MAX_CONSECUTIVE_TIMEOUTS} consecutive ACK timeouts — Bluetooth connection unstable`)
          }
          // For TIMEOUT errors from the stream, wrap with our type
          throw err
        }
        if (err instanceof Error && err.message === 'TIMEOUT') {
          consecutiveTimeouts++
          if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
            throw new FileTransferError('ACK_TIMEOUT', `${MAX_CONSECUTIVE_TIMEOUTS} consecutive ACK timeouts — Bluetooth connection unstable`)
          }
          throw new FileTransferError('ACK_TIMEOUT', `ACK timeout for packet ${wirePacketNum}`)
        }
        throw err
      }

      bytesSent = chunkEnd
      packetsAcked++
      emitProgress('transferring')
    }

    // ── Phase 3: FILE_END ──────────────────────────────────────────
    emitProgress('verifying')
    const endPacket = buildFileEndPacket(crc)
    await writeBinaryToDevice(peripheral, endPacket, true) // write with response
    log(`[FileTransfer] FILE_END sent: CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')}`)

    await waitForAck({ phase: 'end' })
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
    if (silenceChecker) clearInterval(silenceChecker)
    bleEventBus.removeListener('textLine', silenceHandler)
    disconnectCleanup?.()
    transportLock.release(transferId)
    bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: false, ts: Date.now() })
    log(`[FileTransfer] Pipeline cleanup complete`)
  }
}
