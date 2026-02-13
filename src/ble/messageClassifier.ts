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
}

export type ErrorType = 'AI_NACK' | 'TIMEOUT' | 'I2C_ERROR' | 'UNKNOWN'

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
}

/**
 * Patterns for unsolicited messages from firmware
 */
const UNSOLICITED_PATTERNS = [
  /^Wake$/i,
  /^Waking AI processor\.?$/i,
  /^AI processor is awake\.?$/i,
  /^Error bits = 0x[0-9A-Fa-f]+$/i,
  /^Sleep/i,
  /^MD\.\.\./i,
  /^Retrying transmission/i,
  /^RTC set to/i,
  /^UTC is:/i,
  /^System time set successfully$/i,
  /^Device GPS set$/i,
  /^Location is:/i,
  /^heartbeat is/i,
  /^AI processor is in DPD/i,
  /^AI processor not responding\. Waking it\.$/i,
  /^Disconnecting$/i,
  /^Failed to join\.?$/i,
  // Command Echoes (Treat as info, not resolution)
  /^setutc\s+[0-9TZ:-]+$/i,
  /^AI setop\s+\d+\s+\d+$/i,
  /^setgps\s+.*$/i,
  /^AI info$/i,
  /^ver$/i,
  /^battery$/i,
  /^get heartbeat$/i,
  /^flash[rgb]\s+\d+\s+\d+$/i,
  /^selftest$/i,
  /^status$/i,
  /^getutc$/i,
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
 * Classify an incoming BLE message
 */
export function classifyMessage(
  rawMessage: string,
  expectedResponsePattern?: RegExp | false,
): ClassifiedMessage {
  const content = rawMessage.trim()
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

  // Check for unsolicited messages
  for (const pattern of UNSOLICITED_PATTERNS) {
    if (pattern.test(content)) {
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
