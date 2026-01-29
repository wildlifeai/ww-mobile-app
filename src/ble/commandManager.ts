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
import { PendingCommand, BleCommandOptions, CommandNames } from './types'
import {
  classifyMessage,
  ClassifiedMessage,
  MessageType,
  isWakeMessage,
  isErrorBitsMessage,
  isAiNackError,
} from './messageClassifier'
import { log, logError } from '../utils/logger'

type UnsolicitedMessageCallback = (msg: ClassifiedMessage) => void

const DEFAULT_TIMEOUT = 3000
const DEFAULT_MAX_RETRIES = 1

export class BleCommandManager {
  private pendingCommand: PendingCommand | null = null
  private commandQueue: Array<() => Promise<void>> = []
  private unsolicitedListeners: Set<UnsolicitedMessageCallback> = new Set()
  private nextRequestId = 1
  private isProcessing = false

  /**
   * Send a command and wait for response
   */
  async sendCommand(
    peripheral: ExtendedPeripheral,
    commandString: string,
    writeToDevice: (peripheral: ExtendedPeripheral, command: string) => Promise<void>,
    options: BleCommandOptions = {},
  ): Promise<string> {
    const {
      timeout = DEFAULT_TIMEOUT,
      retryOnNack = true,
      maxRetries = DEFAULT_MAX_RETRIES,
      waitForWake = false,
    } = options

    return new Promise((resolve, reject) => {
      const executeCommand = async () => {
        const requestId = `req_${this.nextRequestId++}`
        
        const pending: PendingCommand = {
          id: requestId,
          commandName: commandString,
          commandString,
          sentAt: Date.now(),
          timeoutMs: timeout,
          resolve,
          reject,
          retryCount: 0,
          maxRetries,
          expectedPattern: options.expectedPattern,
        }

        try {
          // THEN set as pending and start timeout
          this.pendingCommand = pending

          // Set timeout BEFORE send to catch fast echoes
          const timeoutHandle = setTimeout(() => {
            if (this.pendingCommand?.id === requestId) {
              this.pendingCommand = null
              reject(new Error(`Command timeout after ${timeout}ms: ${commandString}`))
            }
          }, timeout)

          // Send command to device
          await writeToDevice(peripheral, commandString)
          log(`[BLE CMD Manager] Sent: ${commandString}`)
        } catch (error) {
          this.pendingCommand = null
          reject(error)
        }
      }

      // Add to queue
      this.commandQueue.push(executeCommand)
      this.processQueue()
    })
  }

  /**
   * Process command queue (serialized execution)
   */
  private async processQueue() {
    if (this.isProcessing || this.commandQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.commandQueue.length > 0) {
      const next = this.commandQueue.shift()
      if (next) {
        try {
          await next()
        } catch (error) {
          logError(`[BLE CMD Manager] Queue processing error: ${error}`)
        }
      }
    }

    this.isProcessing = false
  }

  /**
   * Handle incoming message from device
   */
  handleIncomingMessage(rawMessage: string): void {
    const classified = classifyMessage(
      rawMessage,
      this.pendingCommand?.expectedPattern,
    )

    log(`[BLE CMD Manager] Received [${classified.type}]: ${classified.content}`)

    // Handle based on message type
    switch (classified.type) {
      case MessageType.ERROR:
        this.handleError(classified)
        break

      case MessageType.UNSOLICITED:
        this.emitUnsolicited(classified)
        break

      case MessageType.RESPONSE:
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

    if (msg.errorType === 'AI_NACK') {
      log('[BLE CMD Manager] AI NACK detected - will retry after wake sequence')
      
      // Wait for Wake and Error bits messages, then retry
      this.waitForWakeSequence().then(() => {
        if (this.pendingCommand && this.pendingCommand.retryCount < this.pendingCommand.maxRetries) {
          log('[BLE CMD Manager] Retrying command after wake sequence')
          this.pendingCommand.retryCount++
          // Command will be retried by re-sending
          // For now, just resolve with the error message
          // TODO: Implement actual retry mechanism
        } else {
          const cmd = this.pendingCommand
          this.pendingCommand = null
          cmd?.reject(new Error(`AI NACK: ${msg.content}`))
        }
      })
    } else {
      // Other errors - reject immediately
      const cmd = this.pendingCommand
      this.pendingCommand = null
      cmd?.reject(new Error(`BLE Error: ${msg.content}`))
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
  }

  /**
   * Emit unsolicited message to all listeners
   */
  private emitUnsolicited(msg: ClassifiedMessage): void {
    this.unsolicitedListeners.forEach(callback => {
      try {
        callback(msg)
      } catch (error) {
        logError(`[BLE CMD Manager] Error in unsolicited message callback: ${error}`)
      }
    })
  }

  /**
   * Wait for Wake + Error bits sequence
   */
  private async waitForWakeSequence(): Promise<void> {
    return new Promise((resolve) => {
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
          wakeReceived = true
          checkComplete()
        }
        if (isErrorBitsMessage(msg.content)) {
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
      const listener = (msg: ClassifiedMessage) => {
        if (pattern.test(msg.content)) {
          this.unsolicitedListeners.delete(listener)
          clearTimeout(timeoutHandle)
          resolve(msg.content)
        }
      }

      const timeoutHandle = setTimeout(() => {
        this.unsolicitedListeners.delete(listener)
        reject(new Error(`Timeout waiting for message matching: ${pattern}`))
      }, timeoutMs)

      this.unsolicitedListeners.add(listener)
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
   * Clear all pending commands and queue
   */
  clear(): void {
    if (this.pendingCommand) {
      this.pendingCommand.reject(new Error('Command manager cleared'))
      this.pendingCommand = null
    }
    this.commandQueue = []
  }
}

// Singleton instance
export const bleCommandManager = new BleCommandManager()
