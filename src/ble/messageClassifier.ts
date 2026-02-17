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

export type ErrorType = 'AI_NACK' | 'TIMEOUT' | 'I2C_ERROR' | 'DEVICE_SLEEP' | 'UNKNOWN'

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
