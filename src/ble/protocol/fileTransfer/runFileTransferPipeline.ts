/**
 * runFileTransferPipeline.ts
 *
 * Central authority for the BLE file transfer session.
 * Sends file data from the app to the WW500 device's SD card.
 *
 * Invariants:
 *   - The nRF BLE processor wakes the Himax automatically on FILE_START
 *   - Uses TextStreamScope, never raw bleEventBus.on()
 *   - Acquires exclusive transport lock for the entire START→DONE session
 *   - Heartbeats are paused automatically
 *   - Disconnect is detected immediately (event-driven)
 *   - User cancel via AbortSignal
 *   - Silence timeout is transfer-scoped (ftx lines only)
 *   - FILE_START uses 10s timeout for cold-start overhead
 *   - All outcomes produce FileTransferLog
 */

import { Platform } from 'react-native'
import { NativeEventEmitter, NativeModules } from 'react-native'
import BleManager from 'react-native-ble-manager'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { writeBinaryToDevice } from '../../transport'
import { bleEventBus, BleEvent } from '../eventBus'
import { bleTransport } from '../bleTransportController'
import { TextStreamScope, StreamTimeoutError } from '../textStreamScope'
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
 * - The nRF must wake the Himax from DPD
 * - The HX6538 needs to open/create the file on the SD card
 * - First packet in a session has cold-start overhead
 */
const FILE_START_ACK_TIMEOUT_MS = 10_000

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
  const { filename, data, onProgress, abortSignal, windowSize: requestedWindowSize } = options
  const windowSize = requestedWindowSize ?? 1
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
  const modeLabel = windowSize > 1 ? `sliding-window(${windowSize})` : 'stop-and-wait'
  log(`[FileTransfer] ${transferId}: ${filename} ${data.length} bytes, ${totalPackets} packets, CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')} [${modeLabel}]`)

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
      const chunk = data.subarray(offset, chunkEnd)
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
  let isDisconnected = false
  const ackTimes: number[] = [] // capped rolling window for ETA
  const ACK_TIMES_MAX = 50

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
          isDisconnected = true
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
    // Short-circuit if already disconnected
    if (isDisconnected) {
      return Promise.reject(
        new FileTransferError('DISCONNECTED', 'Device disconnected'),
      )
    }

    resetSilenceTimer() // reset on send

    // Cancellation-aware: prevent late-arriving ACKs from executing logic
    // after a timeout/disconnect has already won the race.
    let active = true

    const ackPromise = stream.waitFor((line: string) => {
      if (!active) return false
      const result = matchAck(line, expected)
      if (result.type === 'accept') return true
      if (result.type === 'error') {
        throw new FileTransferError('DEVICE_ERROR', `Device error: ${line}`, result.code)
      }
      if (result.type === 'ignore' && __DEV__) {
        logIgnoredAck(result)
      }
      return false
    }, timeoutMs ?? ACK_TIMEOUT_MS)

    const races: Promise<any>[] = [ackPromise, disconnectPromise, silencePromise]
    if (abortSignal) races.push(abortPromise)

    return Promise.race(races).finally(() => { active = false })
  }

  // ── Acquire transport lock + execute transfer ──────────────────
  try {
    // Ensure no other commands are running
    if (bleTransport.isBusy()) {
      throw new FileTransferError('VALIDATION_FAILED', 'Cannot start transfer while another command is in progress')
    }

    // Acquire lock FIRST, then wake the device. This eliminates the gap
    // where the device can Sleep between the wake check and FILE_START.
    bleTransport.acquireLock(transferId)

    // Ask Android for a fast connection interval for the duration of the
    // session. The one-off request made at connect time (useBle.ts) is
    // renegotiated away by the firmware ~20s after connecting, so it must be
    // re-requested per transfer. Firmware >= feature/ble-fast-transfer also
    // requests fast parameters from its side on FILE_START; either alone
    // helps, both together are belt-and-braces. iOS has no equivalent API.
    // Non-fatal: the transfer still works at the current interval.
    if (Platform.OS === 'android') {
      try {
        await BleManager.requestConnectionPriority(peripheral.id, 1)
        log('[FileTransfer] Requested high connection priority')
      } catch (priorityErr: any) {
        log(`[FileTransfer] requestConnectionPriority failed (non-fatal): ${priorityErr?.message ?? priorityErr}`)
      }
    }

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
        const fileStartT0 = Date.now()
        const startAckPromise = prepareAckWait({ phase: 'start' }, FILE_START_ACK_TIMEOUT_MS)
        if (isDisconnected) throw new FileTransferError('DISCONNECTED', 'Device disconnected before FILE_START')
        await writeBinaryToDevice(peripheral, startPacket, false)
        log(`[FileTransfer] FILE_START sent: ${filename} (${data.length} bytes) [attempt ${sessionAttempt + 1}]`)

        await startAckPromise
        log(`[FileTransfer] FILE_START ACKed (${Date.now() - fileStartT0}ms)`)

        // ── Phase 2: FILE_DATA ────────────────────────────────────────
        emitProgress('transferring')
        let lastProgressEmitTime = Date.now()
        const PROGRESS_THROTTLE_MS = 500    // emit progress at most every 500ms
        const PROGRESS_THROTTLE_PKTS = 10   // or every 10 packets

        const throttledEmitProgress = (packetIndex: number) => {
          const now = Date.now()
          if (
            packetIndex === preBuiltPackets.length - 1 ||
            packetsAcked % PROGRESS_THROTTLE_PKTS === 0 ||
            now - lastProgressEmitTime >= PROGRESS_THROTTLE_MS
          ) {
            emitProgress('transferring')
            lastProgressEmitTime = now
          }
        }

        if (windowSize <= 1) {
          // ── Pipelined Stop-and-Wait ────────────────────────────────
          // After ACK N arrives, we IMMEDIATELY prepare the listener
          // and write packet N+1 BEFORE doing any accounting or
          // progress emission. This minimises the nRF-measured "BLE
          // idle time" that can otherwise trigger the HX6538's 1000ms
          // inactivity timer.
          let consecutiveTimeouts = 0
          let i = 0
          let currentAckPromise: Promise<string>
          let currentAckStartTime: number

          // Send first packet
          {
            const pkt = preBuiltPackets[0]
            wirePacketNum = pkt.wireNum
            currentAckStartTime = Date.now()
            currentAckPromise = prepareAckWait({ phase: 'data', packetNum: pkt.wireNum })
            if (isDisconnected) throw new FileTransferError('DISCONNECTED', 'Device disconnected before write')
            await writeBinaryToDevice(peripheral, pkt.packet, false)
          }

          while (i < preBuiltPackets.length) {
            if (isDisconnected) throw new FileTransferError('DISCONNECTED', 'Device disconnected during transfer')
            if (abortSignal?.aborted) throw new FileTransferError('ABORTED', 'Transfer cancelled by user')

            try {
              await currentAckPromise
              const roundtrip = Date.now() - currentAckStartTime

              // ── HOT PATH: send next packet FIRST ──────────────────
              // The next BLE write must happen before anything else
              // to minimise the gap the firmware measures.
              const nextI = i + 1
              if (nextI < preBuiltPackets.length) {
                const next = preBuiltPackets[nextI]
                wirePacketNum = next.wireNum
                currentAckStartTime = Date.now()
                currentAckPromise = prepareAckWait({ phase: 'data', packetNum: next.wireNum })
                await writeBinaryToDevice(peripheral, next.packet, false)
              }

              // ── ACCOUNTING (next write is already in BLE stack) ────
              ackTimes.push(roundtrip)
              if (ackTimes.length > ACK_TIMES_MAX) ackTimes.shift()
              consecutiveTimeouts = 0
              bytesSent = preBuiltPackets[i].chunkEnd
              packetsAcked++

              if (preBuiltPackets[i].wireNum === 1 && packetsAcked > 1) {
                wrapCycles++
                log(`[FileTransfer] Packet number wrapped 255→1 (cycle ${wrapCycles})`)
              }

              throttledEmitProgress(i)
              i++
            } catch (err: any) {
              const isTimeout = err instanceof StreamTimeoutError ||
                (err instanceof FileTransferError && err.reason === 'ACK_TIMEOUT')
              if (!isTimeout) throw err

              consecutiveTimeouts++
              log(`[FileTransfer] ACK timeout for packet ${wirePacketNum} (${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS})`)
              if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
                throw new FileTransferError('ACK_TIMEOUT', `${MAX_CONSECUTIVE_TIMEOUTS} consecutive ACK timeouts — Bluetooth connection unstable`)
              }

              // Retry: resend current packet
              const pkt = preBuiltPackets[i]
              wirePacketNum = pkt.wireNum
              currentAckStartTime = Date.now()
              currentAckPromise = prepareAckWait({ phase: 'data', packetNum: pkt.wireNum })
              await writeBinaryToDevice(peripheral, pkt.packet, false)
            }
          }
        } else {
          // ── Credit streaming (window > 1) — Phase 3 ─────────────────
          // The previous per-ack waitFor() registered and removed a listener
          // for each ack, leaving a gap (during the next writeWithoutResponse)
          // in which acks were LOST once the device got fast (~45ms/packet) -
          // causing the window to jam and throughput to collapse to ~250 B/s.
          //
          // Instead use ONE persistent listener with no gap. Acks are treated
          // cumulatively: the HX writes and acks strictly in order, so
          // "ftx ack N" means every packet up to the one whose wire number is N
          // is safely written - a missed ack is harmlessly covered by a later
          // one. The sender keeps up to `windowSize` packets in flight so the
          // device is never starved. Stalls are caught by the shared silence
          // timer (SILENCE_TIMEOUT_MS) and disconnect/abort promises.
          log(`[FileTransfer] DATA phase: credit streaming (window=${windowSize})`)

          const total = preBuiltPackets.length
          let nextToSend = 0
          let highestAckedIndex = -1
          let streamErr: FileTransferError | null = null
          let wake: (() => void) | null = null

          // Some Android stacks silently step CONNECTION_PRIORITY_HIGH back
          // down after ~30-60s of sustained traffic (seen as throughput decaying
          // over a long transfer). Re-request it periodically during the stream.
          let lastPriorityRefresh = Date.now()
          const PRIORITY_REFRESH_MS = 20_000

          const onFtxAck = (event: BleEvent) => {
            if (event.type !== 'TEXT_LINE') return
            if (event.deviceId !== peripheral.id) return
            const line = event.line
            if (typeof line !== 'string') return
            if (line.startsWith('ftx ack ')) {
              const tok = line.slice('ftx ack '.length).trim()
              if (tok === '0' || tok === 'end') return // start/end handled elsewhere
              const wire = parseInt(tok, 10)
              if (Number.isNaN(wire)) return
              // Map the (cumulative) wire number to the highest not-yet-acked
              // sent index carrying that wire number.
              for (let i = highestAckedIndex + 1; i < nextToSend; i++) {
                if (preBuiltPackets[i].wireNum === wire) { highestAckedIndex = i; break }
              }
              wake?.()
            } else if (line.startsWith('ftx err ')) {
              const code = parseInt(line.split(' ')[2], 10)
              streamErr = new FileTransferError('DEVICE_ERROR', `Device error: ${line}`, code)
              wake?.()
            }
          }
          bleEventBus.on('textLine', onFtxAck)

          try {
            // Stream until every packet has been SENT (not until every ack is
            // in). With cumulative acks the firmware sends one ack per ~8
            // packets, so the last <8 packets never get their own ack - they
            // are confirmed by FILE_END / "ftx done" below (the HX processes
            // the FIFO strictly in order, so FILE_END lands after all data).
            while (nextToSend < total) {
              if (streamErr) throw streamErr
              if (isDisconnected) throw new FileTransferError('DISCONNECTED', 'Device disconnected during transfer')
              if (abortSignal?.aborted) throw new FileTransferError('ABORTED', 'Transfer cancelled by user')

              // Arm the wakeup BEFORE sending, so an ack that arrives during the
              // writes still resolves it (no gap where acks are lost).
              const advanced = new Promise<void>((resolve) => { wake = resolve })

              // Keep Android holding the fast connection interval (see above)
              if (Platform.OS === 'android' && Date.now() - lastPriorityRefresh > PRIORITY_REFRESH_MS) {
                lastPriorityRefresh = Date.now()
                BleManager.requestConnectionPriority(peripheral.id, 1).catch(() => {})
              }

              // Fill the window: keep <= windowSize packets unacknowledged.
              while (nextToSend < total && (nextToSend - (highestAckedIndex + 1)) < windowSize) {
                await writeBinaryToDevice(peripheral, preBuiltPackets[nextToSend].packet, false)
                nextToSend++
              }

              // Progress (based on cumulative acks)
              if (highestAckedIndex >= 0) {
                bytesSent = preBuiltPackets[highestAckedIndex].chunkEnd
                packetsAcked = highestAckedIndex + 1
                wirePacketNum = preBuiltPackets[highestAckedIndex].wireNum
                throttledEmitProgress(highestAckedIndex)
              }

              // All sent - the tail is confirmed by FILE_END. Otherwise the
              // window is full: wait for an ack to free credit (or error/stall).
              if (nextToSend >= total) break
              const races: Promise<unknown>[] = [advanced, disconnectPromise, silencePromise]
              if (abortSignal) races.push(abortPromise)
              await Promise.race(races)
            }
          } finally {
            bleEventBus.removeListener('textLine', onFtxAck)
            wake = null
          }
        }

        // Log timing summary after data loop
        if (ackTimes.length > 0) {
          const times = ackTimes
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          const min = Math.min(...times)
          const max = Math.max(...times)
          log(`[FileTransfer] DATA phase complete: ${packetsAcked} pkts | avg=${avg}ms min=${min}ms max=${max}ms [${modeLabel}]`)
        }

        // ── Phase 3: FILE_END ────────────────────────────────────────
        emitProgress('verifying')
        const endPacket = buildFileEndPacket(crc)
        
        const fileEndT0 = Date.now()
        const endAckPromise = prepareAckWait({ phase: 'end' })
        if (isDisconnected) throw new FileTransferError('DISCONNECTED', 'Device disconnected before FILE_END')
        await writeBinaryToDevice(peripheral, endPacket, false)
        log(`[FileTransfer] FILE_END sent: CRC=0x${crc.toString(16).toUpperCase().padStart(4, '0')}`)

        await endAckPromise
        log(`[FileTransfer] Transfer complete: "ftx done" received (FILE_END took ${Date.now() - fileEndT0}ms)`)

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

        if (isRecoverable && sessionAttempt <= MAX_SESSION_RETRIES) {
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
    // Return the connection to balanced priority — the fast interval is only
    // needed while packets are flowing, and costs device battery otherwise.
    // Fire-and-forget: rejects if the device already disconnected.
    if (Platform.OS === 'android') {
      BleManager.requestConnectionPriority(peripheral.id, 0).catch(() => {})
    }
    bleTransport.releaseLock(transferId)
    bleEventBus.emitEvent({ type: 'HEARTBEAT_PAUSE', isPaused: false, ts: Date.now() })
    log(`[FileTransfer] Pipeline cleanup complete`)
  }
}
