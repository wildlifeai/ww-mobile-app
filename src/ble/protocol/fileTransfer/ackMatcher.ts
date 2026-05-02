/**
 * Strict ACK matcher for the file transfer protocol.
 *
 * Rules:
 *   - Only the exact expected ACK advances the state machine
 *   - Duplicate, delayed, or wrong-number ACKs are logged but ignored
 *   - "ftx err <N>" always aborts immediately
 *   - Non-ftx lines are ignored (device logs, etc.)
 */

import { log } from '../../../utils/logger'

export type AckMatchResult =
  | { type: 'accept'; line: string }
  | { type: 'error'; code: number; line: string }
  | { type: 'ignore'; line: string; reason: string }

export type ExpectedAck =
  | { phase: 'start' }         // expects "ftx ack 0"
  | { phase: 'data'; packetNum: number }  // expects "ftx ack <N>"
  | { phase: 'end' }           // expects "ftx done"

/**
 * Classify a received line against the expected ACK.
 */
export function matchAck(line: string, expected: ExpectedAck): AckMatchResult {
  const trimmed = line.trim()

  // ─── Error: always abort ───────────────────────────────────────
  const errMatch = trimmed.match(/^ftx err (\d+)$/)
  if (errMatch) {
    return { type: 'error', code: parseInt(errMatch[1], 10), line: trimmed }
  }

  // ─── Expected: ftx ack 0 (FILE_START) ──────────────────────────
  if (expected.phase === 'start') {
    if (trimmed === 'ftx ack 0') {
      return { type: 'accept', line: trimmed }
    }
    if (trimmed.startsWith('ftx ')) {
      return { type: 'ignore', line: trimmed, reason: `Expected 'ftx ack 0', got '${trimmed}'` }
    }
    return { type: 'ignore', line: trimmed, reason: 'Non-ftx line during START phase' }
  }

  // ─── Expected: ftx ack <N> (FILE_DATA) ─────────────────────────
  if (expected.phase === 'data') {
    const ackMatch = trimmed.match(/^ftx ack (\d+)$/)
    if (ackMatch) {
      const receivedNum = parseInt(ackMatch[1], 10)
      if (receivedNum === expected.packetNum) {
        return { type: 'accept', line: trimmed }
      }
      return {
        type: 'ignore',
        line: trimmed,
        reason: `Wrong packet number: expected ${expected.packetNum}, got ${receivedNum}`,
      }
    }
    if (trimmed === 'ftx done') {
      return { type: 'ignore', line: trimmed, reason: 'Unexpected ftx done during DATA phase' }
    }
    if (trimmed.startsWith('ftx ')) {
      return { type: 'ignore', line: trimmed, reason: `Unexpected ftx response: '${trimmed}'` }
    }
    return { type: 'ignore', line: trimmed, reason: 'Non-ftx line during DATA phase' }
  }

  // ─── Expected: ftx done (FILE_END) ─────────────────────────────
  if (expected.phase === 'end') {
    if (trimmed === 'ftx done') {
      return { type: 'accept', line: trimmed }
    }
    if (trimmed.startsWith('ftx ')) {
      return { type: 'ignore', line: trimmed, reason: `Expected 'ftx done', got '${trimmed}'` }
    }
    return { type: 'ignore', line: trimmed, reason: 'Non-ftx line during END phase' }
  }

  return { type: 'ignore', line: trimmed, reason: 'Unknown phase' }
}

/**
 * Log an ignored ACK for debugging.
 */
export function logIgnoredAck(result: AckMatchResult & { type: 'ignore' }) {
  log(`[FileTransfer] Ignored: "${result.line}" — ${result.reason}`)
}
