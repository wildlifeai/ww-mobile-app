/**
 * BLE Command Manager
 * 
 * Manages serialized command execution with Promise-based API.
 * Ensures only one command is in-flight at a time and handles:
 * - Request-response correlation
 * - AI NACK automatic retry
 * - Wake sequence handling
 * - Unsolicited message routing
 */

import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { PendingCommand, BleCommandOptions, WriteFunction, CommandNames } from './types'
import {
  classifyMessage,
  ClassifiedMessage,
  MessageType,
  isWakeMessage,
  isErrorBitsMessage,
} from './messageClassifier'
import { log, logError, logWarn } from '../utils/logger'

type UnsolicitedMessageCallback = (msg: ClassifiedMessage) => void

const DEFAULT_TIMEOUT = 3000
const DEFAULT_MAX_RETRIES = 1

export class BleCommandManager {
  private pendingCommand: PendingCommand | null = null
  private commandQueue: Array<{ execute: () => Promise<void>; reject: (reason?: any) => void }> = []
  private unsolicitedListeners: Set<UnsolicitedMessageCallback> = new Set()
  private messageListeners: Set<(raw: string) => void> = new Set()
  private nextRequestId = 1
  private isProcessing = false

  /**
   * Send a command and wait for response
   */
  async sendCommand(
    peripheral: ExtendedPeripheral,
    command: { name: CommandNames | string; string: string },
    writeToDevice: WriteFunction,
    options: BleCommandOptions = {},
  ): Promise<string> {
    const {
      timeout = DEFAULT_TIMEOUT,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = options

    return new Promise((resolve, reject) => {
      // Add to queue - the actual execution happens in processQueue
      this.commandQueue.push({
        execute: async () => {
          const requestId = `req_${this.nextRequestId++}`
          
          const pending: PendingCommand = {
          id: requestId.toString(),
          commandName: command.name, 
          commandString: command.string,
          sentAt: Date.now(),
          timeoutMs: timeout,
          resolve,
          reject,
          retryCount: 0,
          maxRetries,
          expectedPattern: options.expectedPattern,
          writeToDevice,
          peripheral
        }

          try {
            // Set as pending and start timeout
            this.pendingCommand = pending

            // Set timeout BEFORE send to catch fast echoes
            const timeoutHandle = setTimeout(() => {
              if (this.pendingCommand?.id === requestId) {
                const cmd = this.pendingCommand
                
                // If we have retries left, trigger a retry instead of failing immediately
                if (cmd.retryCount < cmd.maxRetries) {
                  logWarn(`[BLE CMD Manager] Command timeout after ${timeout}ms. Retrying (${cmd.retryCount + 1}/${cmd.maxRetries})...`)
                  this.handleError({
                    type: MessageType.ERROR,
                    content: `Timeout after ${timeout}ms`,
                    timestamp: Date.now(),
                    errorType: 'TIMEOUT',
                    raw: ''
                  })
                  return
                }

                this.pendingCommand = null
                this.processQueue() // Resume queue processing
                
                const notReceived = !cmd.echoReceived ? ' (No Echo Received)' : ''
                reject(new Error(`Command timeout after ${timeout}ms: ${this.redact(command.string)}${notReceived}`))
              }
            }, timeout)
            pending.timeoutHandle = timeoutHandle

            // Send command to device
            await writeToDevice(peripheral, command.string)
            log(`[BLE CMD Manager] Sent: ${this.redact(command.string)}`)
            
            // Note: resolve/reject will be called by handleResponse/handleError
            // which will also call processQueue() to handle the next command

            // Handle Fire-and-Forget (expectedPattern: false)
            // UPDATED: We now WAIT for the echo even for fire-and-forget
            if (options.expectedPattern === false) {
               // log(`[BLE CMD Manager] Fire-and-forget: ${commandString} - Waiting for Echo...`)
               // Do NOT resolve here. We wait for echo in handleIncomingMessage
            }
          } catch (error) {
            this.pendingCommand = null
            // this.processQueue() // REMOVED: Managed by processQueue loop now
            reject(error)
          }
        },
        reject: (reason) => {
          reject(reason)
        }
      })
      
      this.processQueue()
    })
  }

  /**
   * Process command queue (serialized execution)
   * Only processes next command after current one completes
   */
  private async processQueue() {
    // CRITICAL: only process if not already processing AND no command is currently waiting for a response
    if (this.isProcessing || this.pendingCommand || this.commandQueue.length === 0) {
      if (this.commandQueue.length > 0 && this.pendingCommand) {
        log(`[BLE CMD Manager] Queue waiting: ${this.commandQueue.length} items pending. Current: ${this.redact(this.pendingCommand.commandString)}`)
      }
      return
    }

    this.isProcessing = true
    // log(`[BLE CMD Manager] Processing queue. Depth: ${this.commandQueue.length}`)

    try {
      // Loop until queue is empty or we are waiting for a response
      while (this.commandQueue.length > 0) {
        // Double check not waiting (in case logic changed)
        if (this.pendingCommand) {
             break
        }

        const nextItem = this.commandQueue.shift()
        if (nextItem) {
          try {
            await nextItem.execute()
            
            // If pendingCommand is set, it means we are waiting for response.
            // Break loop and wait for handleResponse/timeout to call processQueue again.
            if (this.pendingCommand) {
                break
            }
            // If pendingCommand is null here, it means execute finished immediately.
            // This is expected for fire-and-forget execution (error caught inside or F&F resolved).
            // logWarn('[BLE CMD Manager] Command finished without pending state (write error?), processing next...')
          } catch (error) {
            logError(`[BLE CMD Manager] Queue processing error: ${error}`)
            // Continue to next
          }
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Handle incoming message from device
   */
  handleIncomingMessage(rawMessage: string): void {
    const trimmedMsg = rawMessage.trim()

    // 1. ECHO CHECK (Strict Mode)
    // Check if this is the echo of the pending command
    if (this.pendingCommand && !this.pendingCommand.echoReceived) {
        // Simple string match check. 
        // Note: Sometimes echoes might have extra whitespace or be partial if not reading line-by-line correctly,
        // but assuming full line messages here.
        if (trimmedMsg === this.pendingCommand.commandString.trim()) {
            log(`[BLE CMD Manager] Echo received: ${this.redact(trimmedMsg)}`)
            this.pendingCommand.echoReceived = true

            // If this was a Fire-and-Forget command, we can resolve now!
            if (this.pendingCommand.expectedPattern === false) {
                const cmd = this.pendingCommand
                this.pendingCommand = null
                cmd.resolve('Echo received (Fire-and-forget)')
                this.processQueue()
            }
            
            return // Stop processing this message (it's just an echo)
        }
    }

    const classified = classifyMessage(
      rawMessage,
      this.pendingCommand?.expectedPattern,
    )

    log(`[BLE CMD Manager] Received [${classified.type}]: ${classified.content}`)

    // Notify raw message listeners (used by waitForMessage)
    // Clone set to ensure safety if listeners remove themselves during iteration
    const listeners = [...this.messageListeners]
    listeners.forEach(listener => {
      try { listener(rawMessage) } catch { /* ignore */ }
    })

    // Handle based on message type
    switch (classified.type) {
      case MessageType.ERROR:
        if (this.pendingCommand?.timeoutHandle) {
          clearTimeout(this.pendingCommand.timeoutHandle)
        }
        this.handleError(classified)
        break

      case MessageType.UNSOLICITED:
      case MessageType.INFO:
        this.emitUnsolicited(classified)
        break

      case MessageType.RESPONSE:
        // If we were expecting a specific pattern, but match was only via fallback (default response),
        // then we should NOT resolve unless the content actually matches our expectation.
        if (this.pendingCommand?.expectedPattern instanceof RegExp && classified.isFallbackResponse) {
            const isDisconnecting = this.pendingCommand?.commandName === CommandNames.dis || this.pendingCommand?.commandString === 'dis'
            if (!isDisconnecting) {
                logWarn(`[BLE CMD Manager] Ignoring unknown message while waiting for ${this.pendingCommand.expectedPattern}: ${classified.content}`)
            }
            this.emitUnsolicited(classified)
            break
        }

        if (this.pendingCommand?.timeoutHandle) {
          clearTimeout(this.pendingCommand.timeoutHandle)
        }
        this.handleResponse(classified)
        break
    }
  }

  /**
   * Handle error messages (AI NACK, I2C errors)
   */
  private handleError(msg: ClassifiedMessage): void {
    if (!this.pendingCommand) {
      logError(`[BLE CMD Manager] Received error but no pending command: ${msg.content}`)
      return
    }

    if (msg.errorType === 'AI_NACK' || msg.errorType === 'DEVICE_SLEEP' || msg.errorType === 'TIMEOUT' || msg.errorType === 'DEVICE_BUSY') {
      const reason = msg.errorType === 'AI_NACK' ? 'AI NACK' : (msg.errorType === 'DEVICE_SLEEP' ? 'Device Sleep' : (msg.errorType === 'DEVICE_BUSY' ? 'Device Busy' : 'Timeout'))
      
      const failedCommand = this.pendingCommand

      const executeRetry = () => {
        if (failedCommand && failedCommand.retryCount < failedCommand.maxRetries) {
          log(`[BLE CMD Manager] Retrying command ${reason} (attempt ${failedCommand.retryCount + 1}/${failedCommand.maxRetries}): ${this.redact(failedCommand.commandString)}`)

          // Clear pending and increment retry count
          failedCommand.retryCount++
          
          // CRITICAL: Reset echoReceived so the echo of the retried command is matched correctly
          failedCommand.echoReceived = false

          // Re-queue the command with updated retry count
          // IMPORTANT: We use unshift to put it at the FRONT of the queue
          this.commandQueue.unshift({
            execute: async () => {
              this.pendingCommand = failedCommand
              
              // Send command again using stored write function
              try {
                // Clear any previous timeout handle since we are restarting the command
                if (failedCommand.timeoutHandle) clearTimeout(failedCommand.timeoutHandle)
                
                // Restart timeout logic for the retry
                const newTimeoutHandle = setTimeout(() => {
                  if (this.pendingCommand?.id === failedCommand.id) {
                    const cmd = this.pendingCommand
                    // RECURSIVE RETRY CHECK: If we still have retries, trigger another handleError for TIMEOUT
                    if (cmd.retryCount < cmd.maxRetries) {
                        logWarn(`[BLE CMD Manager] Retry timeout. Retrying again...`)
                        this.handleError({
                            type: MessageType.ERROR,
                            content: `Retry Timeout`,
                            timestamp: Date.now(),
                            errorType: 'TIMEOUT',
                            raw: ''
                        })
                        return
                    }

                    this.pendingCommand = null
                    failedCommand.reject(new Error(`Retry timeout after ${failedCommand.timeoutMs}ms: ${this.redact(failedCommand.commandString)}`))
                    // Only process queue after rejection is handled
                    this.processQueue()
                  }
                }, failedCommand.timeoutMs)
                failedCommand.timeoutHandle = newTimeoutHandle

                await failedCommand.writeToDevice(failedCommand.peripheral, failedCommand.commandString)
                log(`[BLE CMD Manager] Retry command sent: ${this.redact(failedCommand.commandString)}`)
              } catch (e) {
                logError(`[BLE CMD Manager] Retry write failed: ${e}`)
                this.pendingCommand = null
                if (failedCommand.timeoutHandle) clearTimeout(failedCommand.timeoutHandle)
                failedCommand.reject(e as Error)
                this.processQueue() 
              }
            },
            reject: (r: any) => {
              failedCommand.reject(r)
            }
          })
          
          this.processQueue()
        } else {
          // Max retries exceeded
          this.pendingCommand = null
          failedCommand?.reject(new Error(`${reason}: Max retries (${failedCommand?.maxRetries}) exceeded`))
          this.processQueue()
        }
      }

      if (msg.errorType === 'DEVICE_BUSY') {
        log(`[BLE CMD Manager] Device busy - retrying in 1s`)
        setTimeout(executeRetry, 1000)
      } else {
        log(`[BLE CMD Manager] ${reason} detected - waiting for wake sequence then retrying`)
        this.lastWakeReceivedAt = 0
        this.lastErrorBitsReceivedAt = 0
        this.waitForWakeSequence().then(executeRetry)
      }
    } else {
      // Other errors - reject immediately
      const cmd = this.pendingCommand
      this.pendingCommand = null
      cmd?.reject(new Error(`BLE Error: ${msg.content}`))
      this.processQueue()
    }
  }

  /**
   * Handle response messages
   */
  private handleResponse(msg: ClassifiedMessage): void {
    if (!this.pendingCommand) {
      log(`[BLE CMD Manager] Received response but no pending command: ${msg.content}`)
      return
    }

    // Resolve the pending command
    const cmd = this.pendingCommand
    this.pendingCommand = null
    cmd.resolve(msg.content)
    
    // Process next command in queue
    this.processQueue()
  }

  /**
   * Emit unsolicited message to all listeners
   */
  private emitUnsolicited(msg: ClassifiedMessage): void {
    if (isWakeMessage(msg.content)) {
      this.lastWakeReceivedAt = Date.now()
    }
    if (isErrorBitsMessage(msg.content)) {
      this.lastErrorBitsReceivedAt = Date.now()
    }

    this.unsolicitedListeners.forEach(callback => {
      try {
        callback(msg)
      } catch (error) {
        logError(`[BLE CMD Manager] Error in unsolicited message callback: ${error}`)
      }
    })
  }

  private lastWakeReceivedAt = 0
  private lastErrorBitsReceivedAt = 0

  /**
   * Wait for Wake + Error bits sequence
   */
  private async waitForWakeSequence(): Promise<void> {
    const WAKE_WINDOW_MS = 10000 // 10s window to consider device "recently awake"

    return new Promise((resolve) => {
      const now = Date.now()
      
      // Optimization: If we received both Wake and Error bits very recently, skip the wait.
      // This happens when a command times out but the device sends wake messages right AFTER the timeout.
      if (
        (now - this.lastWakeReceivedAt < WAKE_WINDOW_MS) && 
        (now - this.lastErrorBitsReceivedAt < WAKE_WINDOW_MS)
      ) {
        log(`[BLE CMD Manager] Device recently awake (Wake ${now - this.lastWakeReceivedAt}ms ago, ErrorBits ${now - this.lastErrorBitsReceivedAt}ms ago). Skipping wait.`)
        resolve()
        return
      }

      let wakeReceived = false
      let errorBitsReceived = false

      const checkComplete = () => {
        if (wakeReceived && errorBitsReceived) {
          this.unsolicitedListeners.delete(listener)
          resolve()
        }
      }

      const listener = (msg: ClassifiedMessage) => {
        if (isWakeMessage(msg.content)) {
          this.lastWakeReceivedAt = Date.now()
          wakeReceived = true
          checkComplete()
        }
        if (isErrorBitsMessage(msg.content)) {
          this.lastErrorBitsReceivedAt = Date.now()
          errorBitsReceived = true
          checkComplete()
        }
      }

      this.unsolicitedListeners.add(listener)

      // Timeout after 5 seconds
      setTimeout(() => {
        this.unsolicitedListeners.delete(listener)
        resolve() // Resolve anyway to prevent hanging
      }, 5000)
    })
  }

  /**
   * Wait for a specific message pattern
   */
  async waitForMessage(pattern: RegExp, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const listener = (raw: string) => {
        if (pattern.test(raw)) {
          this.messageListeners.delete(listener)
          clearTimeout(timeoutHandle)
          resolve(raw)
        }
      }

      const timeoutHandle = setTimeout(() => {
        this.messageListeners.delete(listener)
        reject(new Error(`Timeout waiting for message matching: ${pattern}`))
      }, timeoutMs)

      this.messageListeners.add(listener)
    })
  }

  /**
   * Subscribe to unsolicited messages
   */
  onUnsolicitedMessage(callback: UnsolicitedMessageCallback): () => void {
    this.unsolicitedListeners.add(callback)
    return () => {
      this.unsolicitedListeners.delete(callback)
    }
  }

  /**
   * Subscribe to ALL raw incoming messages
   */
  addMessageListener(listener: (msg: string) => void): void {
      this.messageListeners.add(listener)
  }

  /**
   * Unsubscribe from raw incoming messages
   */
  removeMessageListener(listener: (msg: string) => void): void {
      this.messageListeners.delete(listener)
  }

  /**
   * Clear all pending commands and queue
   */
  clear(): void {
    if (this.pendingCommand) {
      if (this.pendingCommand.timeoutHandle) {
         clearTimeout(this.pendingCommand.timeoutHandle)
      }
      this.pendingCommand.reject(new Error('Command manager cleared'))
      this.pendingCommand = null
    }
    this.commandQueue.forEach(item => {
      item.reject(new Error('Command manager cleared'))
    })
    this.commandQueue = []
    this.messageListeners.clear()
  }

  /**
   * Redacts sensitive data from command strings for logging
   */
  private redact(data: string): string {
    const isSensitive = /\b(setgps|appkey|appeui|deveui|setutc)\b/i.test(data)
    return isSensitive ? "[REDACTED]" : data
  }
}

// Singleton instance
export const bleCommandManager = new BleCommandManager()
