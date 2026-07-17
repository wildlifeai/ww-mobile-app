/**
 * BLE Message Classification System
 * 
 * Categorizes incoming BLE messages into:
 * - RESPONSE: Direct responses to commands we sent
 * - UNSOLICITED: Async messages from device (Wake, Error bits, MD, Sleep, etc.)
 * - ERROR: Error messages (AI NACK, I2C errors, timeouts)
 */

export enum MessageType {
  RESPONSE = 'RESPONSE',
  UNSOLICITED = 'UNSOLICITED',
  ERROR = 'ERROR',
  INFO = 'INFO', // Successful status messages (Wake, Error bits check, etc.)
}

export type ErrorType = 'AI_NACK' | 'TIMEOUT' | 'I2C_ERROR' | 'DEVICE_SLEEP' | 'DEVICE_BUSY' | 'CONFIG_ERROR' | 'UNKNOWN'

export interface ClassifiedMessage {
  type: MessageType
  content: string
  timestamp: number
  // For responses: which command this responds to
  respondsTo?: string
  // For errors
  errorType?: ErrorType
  // Raw message for debugging
  raw: string
  // Flag if this was designated as RESPONSE by fallback (no pattern matched)
  isFallbackResponse?: boolean
}

/**
 * Patterns for unsolicited messages from firmware
 */
const UNSOLICITED_PATTERNS = [
  // Wake patterns moved to INFO_PATTERNS
  /Error bits = 0x[0-9A-Fa-f]+/i, 
  /Sleep(\s+.*)?/i,
  /MD\.\.\./i,
  /Retrying transmission/i,
  /RTC set to/i,
  /UTC is:/i,
  /System time set successfully/i,
  /Device GPS set/i,
  /Location is:/i,
  /heartbeat is/i,
  /AI processor is in DPD/i,
  /AI processor not responding\. Waking it\.$/i,
  /Disconnecting/i,
  /Failed to join\.?$/i,
  // Command Echoes (Treat as info, not resolution)
  /setutc\s+[0-9TZ:-]+$/i,
  /AI setop\s+\d+\s+\d+$/i,
  /setgps\s+.*$/i,
  /AI info$/i,
  /ver$/i,
  /battery$/i,
  /get heartbeat$/i,
  /flash[rgb]\s+\d+\s+\d+$/i,
  /selftest$/i,
  /status$/i,
  /getutc$/i,
]

/**
 * Patterns for error messages
 */
const ERROR_PATTERNS = [
  { pattern: /^AI NACK$/i, type: 'AI_NACK' as ErrorType },
  { pattern: /^I2C error: address NACK$/i, type: 'I2C_ERROR' as ErrorType },
  { pattern: /^Discarding message as there is already one pending$/i, type: 'I2C_ERROR' as ErrorType },
  { pattern: /^Camera system not enabled$/i, type: 'CONFIG_ERROR' as ErrorType },
]

/**
 * Patterns for successful status updates (treated as INFO)
 */
const INFO_PATTERNS = [
  /^Wake$/i,
  /^Waking AI processor\.?$/i,
  /^AI processor is awake\.?$/i,
  /^Error bits = 0x0000$/i, // Only 0x0000 is success
]

/**
 * Classify an incoming BLE message
 */
export function classifyMessage(
  rawMessage: string,
  expectedResponsePattern?: RegExp | false,
): ClassifiedMessage {
  // Remove null bytes and trim whitespace
  const content = rawMessage.replace(/\0/g, '').trim()
  const timestamp = Date.now()

  // Check for errors first
  for (const { pattern, type } of ERROR_PATTERNS) {
    if (pattern.test(content)) {
      return {
        type: MessageType.ERROR,
        content,
        timestamp,
        errorType: type,
        raw: rawMessage,
      }
    }
  }

  // If we have an expected response pattern, check if this matches
  // Priority: Check expectation BEFORE unsolicited to handle commands like 'wake'
  if (expectedResponsePattern && expectedResponsePattern.test(content)) {
    return {
      type: MessageType.RESPONSE,
      content,
      timestamp,
      raw: rawMessage,
    }
  }

  // Check for INFO messages (Success indicators) - moved AFTER expected check
  for (const pattern of INFO_PATTERNS) {
      if (pattern.test(content)) {
          return {
              type: MessageType.INFO,
              content,
              timestamp,
              raw: rawMessage
          }
      }
  }

  // Check for unsolicited messages
  for (const pattern of UNSOLICITED_PATTERNS) {
    if (pattern.test(content)) {
      // SPECIAL CASE: If this is a Sleep message and we are waiting for a getop response,
      // we check if we can extract the value from the Sleep stats.
      if (/^Sleep/i.test(content) && expectedResponsePattern) {
        // Check if the expected pattern looks like a getop pattern: /^Op(?:Param\s+|\[)(\d+)\]?\s+=\s+(.+)$/i
        const patternStr = expectedResponsePattern.toString()
        if (patternStr.includes('Op') && patternStr.includes('=')) {
          const match = content.match(/^Sleep\s+(.+)$/i)
          if (match) {
            const stats = match[1].split(/\s+/)
            // We need to know WHICH op index was requested.
            // The expectedPattern usually has the index hardcoded if it's from a specific command,
            // OR it has a capture group for index.
            const indexMatch = patternStr.match(/(\d+)/)
            if (indexMatch) {
              const opIndex = parseInt(indexMatch[1], 10)
              if (opIndex >= 20 && opIndex <= 27 && stats[opIndex]) {
                return {
                  type: MessageType.RESPONSE,
                  content: `Op[${opIndex}] = ${stats[opIndex]}`, // Map to expected format
                  timestamp,
                  raw: rawMessage,
                }
              }
            }
          }
        }

        // If we didn't extract a RESPONSE above, but we ARE waiting for a command,
        // treat Sleep as a DEVICE_SLEEP error to trigger a retry.
        return {
          type: MessageType.ERROR,
          content,
          timestamp,
          errorType: 'DEVICE_SLEEP',
          raw: rawMessage,
        }
      }

      return {
        type: MessageType.UNSOLICITED,
        content,
        timestamp,
        raw: rawMessage,
      }
    }
  }

  // Default to RESPONSE if it doesn't match unsolicited or error patterns
  // This handles responses that don't have a specific pattern
  return {
    type: MessageType.RESPONSE,
    content,
    timestamp,
    raw: rawMessage,
    isFallbackResponse: true, // Mark as fallback
  }
}

/**
 * Check if a message is a wake-related message
 */
export function isWakeMessage(message: string): boolean {
  return /^(Wake|Waking AI processor|AI processor is awake)/i.test(message.trim())
}

/**
 * Check if a message is an Error bits message
 */
export function isErrorBitsMessage(message: string): boolean {
  return /^Error bits = 0x[0-9A-Fa-f]+$/i.test(message.trim())
}

/**
 * Extract error bits value from message
 */
export function extractErrorBits(message: string): string | null {
  const match = message.match(/Error bits = (0x[0-9A-Fa-f]+)/i)
  return match ? match[1] : null
}

/**
 * Check if a message indicates AI NACK error
 */
export function isAiNackError(message: string): boolean {
  return /^AI NACK$/i.test(message.trim())
}

/**
 * Extract an Operational Parameter value from a Sleep status message
 * Sleep messages can contain 28+ space-separated stats values.
 * Ops 20-27 are at indices 20-27 in the stats payload.
 */
export function extractOpParamFromSleep(message: string, opIndex: number): string | null {
  const trimmed = message.trim()
  if (!/^Sleep\s+/i.test(trimmed)) return null

  // Extract the stats part (everything after "Sleep")
  const statsPart = trimmed.replace(/^Sleep\s+/i, '')
  const stats = statsPart.split(/\s+/)

  // Ops 20-27 are directly mapped to indices 20-27 in the array
  if (opIndex >= 20 && opIndex <= 27) {
    const value = stats[opIndex]
    return value || null
  }

  return null
}

export type MonitorCategory = 'motion' | 'motion_rejected' | 'timelapse' | 'capture' | 'nn_positive' | 'nn_negative' | 'sleep' | 'wake' | 'selftest_ok' | 'selftest_warn' | 'info'

export interface MonitorEvent {
  category: MonitorCategory
  label: string
  icon: string
  details?: string
  isHidden?: boolean
}

/**
 * Classify raw BLE messages for the Live Deployment Monitor view.
 * Returns null if the message should not be displayed in the monitor log.
 */
export function classifyForMonitor(rawMessage: string): MonitorEvent | null {
  const content = rawMessage.replace(/\0/g, '').trim()

  // --- MD GLOBAL-MOTION REJECTION (op33) ---
  // The firmware skipped the capture: the whole scene moved (camera knock/pan
  // or a lighting change), not an animal. Must precede the generic /^MD[\s.]/
  // motion match below, which would otherwise mislabel this "Motion detected".
  const mdRejected = content.match(/^MD wake rejected: motion in (\d+) blocks > max (\d+)/i)
  if (mdRejected) {
    return { category: 'motion_rejected', label: `Motion rejected — whole scene moved (${mdRejected[1]} blocks, max ${mdRejected[2]})`, icon: 'motion-sensor-off', details: content }
  }
  // Companion accept message (only emitted when op33 is armed) — a real motion
  // wake, with the block count the rejection filter measured.
  const mdAccepted = content.match(/^MD wake accepted: motion in (\d+) blocks/i)
  if (mdAccepted) {
    return { category: 'motion', label: `Motion detected (${mdAccepted[1]} blocks)`, icon: 'run', details: content }
  }

  // --- WAKE & MOTION EVENTS ---
  if (/^MD[\s.]/i.test(content) || /^Wake\s*\(MD\)/i.test(content)) return { category: 'motion', label: 'Motion detected', icon: 'run', details: content }
  
  // Himax WW500 hardware outputs block counts dynamically
  const motionMatch = content.match(/^HM0360 motion in (\d+) blocks:/i)
  if (motionMatch) {
    const blocks = parseInt(motionMatch[1], 10)
    if (blocks > 0) {
      return { category: 'motion', label: `Motion detected (${blocks} blocks)`, icon: 'run', details: content }
    } else {
      return null // Safely ignore 0 block updates to prevent UI noise
    }
  }

  // --- TIMELAPSE EVENTS ---
  if (/^Timer\s/i.test(content) || /^Wake\s*\(Timer\)/i.test(content)) return { category: 'timelapse', label: 'Timelapse triggered', icon: 'timer-sand', details: content }



  // --- CAPTURE EVENTS ---
  const captureMatch = content.match(/^Captured\s+(\d+)\s+images/i)
  if (captureMatch) {
    const fileMatch = content.match(/Last is\s+(.+)$/i)
    // Hidden because it clutters the UI (stats bar tracks photo count)
    return { category: 'capture', label: `Captured ${captureMatch[1]} photos`, icon: 'camera', details: fileMatch ? fileMatch[1] : undefined, isHidden: true }
  }

  // --- NEURAL NETWORK EVENTS ---
  if (/^NN\+/i.test(content)) return { category: 'nn_positive', label: 'Target species detected!', icon: 'target-account' }
  if (/^NN-/i.test(content)) return { category: 'nn_negative', label: 'Photo taken — no target detected', icon: 'image-outline' }

  // --- HEARTBEAT EVENT ---
  if (/^heartbeat is\s/i.test(content)) return { category: 'selftest_ok', label: 'No motion in last 50 seconds', icon: 'check-circle' }

  // --- SELF-TEST EVENTS ---
  if (/^Error bits = 0x/i.test(content) && !/^Error bits = 0x0000/i.test(content)) return { category: 'selftest_warn', label: 'Self-test warning', icon: 'alert', details: content }

  // --- FILTER OUT KNOWN NOISE ---
  const ignoredPatterns = [
    /^Retrying transmission/i, /^RTC set to/i, /^UTC is:/i, /^System time set successfully/i, /^Device GPS set/i, /^Location is:/i,
    /^AI processor is in DPD/i, /^AI processor not responding/i, /^Disconnecting/i, /^Failed to join/i,
    /^Sleep/i, /^(Wake|Waking AI processor|AI processor is awake)/i, /^Error bits = 0x0000/i,
    // Command echoes
    /^setutc\s/i, /^AI setop\s/i, /^AI getop/i, /^setgps\s/i, /^AI info/i, /^ver/i, /^battery/i, /^get heartbeat/i, /^flash[rgb]\s/i, /^selftest/i, /^status/i, /^getutc/i,
    // OpParam responses (already shown in stats header)
    /^Op(?:Param)?(?:\s+|\[)\d+\]?\s*=/i, /^Set\s+OpParam/i,
    // Debug & Matrix Noise
    /^HM0360 AE regs:/i, /^Integration time/i, /^Analog gain/i, /^Digital gain/i, /^AE Mean/i, /^AEConverged/i,
    // Catches pure hex matrices, often dumped out over device UART during motion scan checks
    /^([0-9a-fA-F]{2}\s*)+$/i
  ]

  for (const pattern of ignoredPatterns) {
    if (pattern.test(content)) return null
  }

  // Pass-through everything else as an info message so we can debug unknown lines
  return { category: 'info', label: 'Device says:', icon: 'information', details: content }
}
