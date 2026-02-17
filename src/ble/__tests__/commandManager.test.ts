import { BleCommandManager } from '../commandManager'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { MessageType } from '../messageClassifier'

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: jest.fn(),
  logError: jest.fn(),
}))

describe('BleCommandManager', () => {
  let manager: BleCommandManager
  let mockPeripheral: ExtendedPeripheral
  let mockWriteToDevice: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    manager = new BleCommandManager()
    mockPeripheral = { id: 'test-device' } as ExtendedPeripheral
    mockWriteToDevice = jest.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    manager.clear()
    jest.useRealTimers()
  })

  describe('sendCommand', () => {
    it('should send command and wait for response', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'ver',
        mockWriteToDevice,
      )

      // Simulate device response delay
      setTimeout(() => {
        manager.handleIncomingMessage('WW500-C02 V 00.08.14')
      }, 10)

      // Advance timer to trigger the response
      jest.advanceTimersByTime(10)

      const response = await commandPromise

      expect(mockWriteToDevice).toHaveBeenCalledWith(mockPeripheral, 'ver')
      expect(response).toBe('WW500-C02 V 00.08.14')
    })

    it('should timeout if no response received', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'ver',
        mockWriteToDevice,
        { timeout: 100 },
      )

      jest.advanceTimersByTime(100)

      await expect(commandPromise).rejects.toThrow('Command timeout after 100ms: ver')
    })

    // TODO: Fix timing issues with fake timers in this test
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should serialize multiple commands', async () => {
      const command1 = manager.sendCommand(mockPeripheral, 'ver', mockWriteToDevice)
      const command2 = manager.sendCommand(mockPeripheral, 'battery', mockWriteToDevice)

      // First command should be sent immediately
      expect(mockWriteToDevice).toHaveBeenCalledTimes(1)
      expect(mockWriteToDevice).toHaveBeenCalledWith(mockPeripheral, 'ver')

      // Flush microtasks to ensure processQueue state is updated (isProcessing -> false)
      await Promise.resolve()

      // Respond to first command
      manager.handleIncomingMessage('WW500-C02 V 00.08.14')
      await command1

      // Advance timers and allow microtasks to process
      jest.advanceTimersByTime(0)
      await Promise.resolve() // Yield to event loop
      await Promise.resolve()

      // Second command should now be sent
      expect(mockWriteToDevice).toHaveBeenCalledTimes(2)
      expect(mockWriteToDevice).toHaveBeenCalledWith(mockPeripheral, 'battery')

      // Respond to second command
      manager.handleIncomingMessage('Battery = 100%')
      await command2
    })
  })

  describe('handleIncomingMessage', () => {
    it('should classify and route RESPONSE messages', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'ver',
        mockWriteToDevice,
      )

      manager.handleIncomingMessage('WW500-C02 V 00.08.14')

      const response = await commandPromise
      expect(response).toBe('WW500-C02 V 00.08.14')
    })

    it('should emit UNSOLICITED/INFO messages to listeners', (done) => {
      const unsubscribe = manager.onUnsolicitedMessage((msg) => {
        expect(msg.type).toBe(MessageType.INFO)
        expect(msg.content).toBe('Wake')
        unsubscribe()
        done()
      })

      manager.handleIncomingMessage('Wake')
    })

    // TODO: Fix timing issues with wake sequence timeout in this test
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should handle ERROR messages', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'AI info',
        mockWriteToDevice,
        { timeout: 1000 }
      )

      manager.handleIncomingMessage('AI NACK')
      
      // 1. Trigger wake sequence timeout (5000ms)
      jest.advanceTimersByTime(5050)
      await Promise.resolve() // Allow retry logic (microtask) to run and schedule next timer

      // 2. Trigger command retry timeout (1000ms)
      jest.advanceTimersByTime(1100)

      await expect(commandPromise).rejects.toThrow()
    })
  })

  describe('waitForMessage', () => {
    it('should resolve when matching message received', async () => {
      const waitPromise = manager.waitForMessage(/Error bits = 0x/, 1000)

      setTimeout(() => {
        manager.handleIncomingMessage('Error bits = 0x0000')
      }, 10)

      jest.advanceTimersByTime(10)

      const message = await waitPromise
      expect(message).toBe('Error bits = 0x0000')
    })

    it('should timeout if message not received', async () => {
      const waitPromise = manager.waitForMessage(/Error bits = 0x/, 100)
      
      jest.advanceTimersByTime(100)

      await expect(waitPromise).rejects.toThrow('Timeout waiting for message matching')
    })
  })

  describe('onUnsolicitedMessage', () => {
    it('should notify all subscribers', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      manager.onUnsolicitedMessage(callback1)
      manager.onUnsolicitedMessage(callback2)

      manager.handleIncomingMessage('Wake')

      expect(callback1).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          content: 'Wake',
        }),
      )
      expect(callback2).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          content: 'Wake',
        }),
      )
    })

    it('should allow unsubscribing', () => {
      const callback = jest.fn()
      const unsubscribe = manager.onUnsolicitedMessage(callback)

      manager.handleIncomingMessage('Wake')
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()

      manager.handleIncomingMessage('Wake')
      expect(callback).toHaveBeenCalledTimes(1) // Not called again
    })
  })

  describe('clear', () => {
    it('should reject pending command', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'ver',
        mockWriteToDevice,
      )

      manager.clear()

      try {
        await commandPromise
        fail('Should have rejected')
      } catch (error: any) {
        expect(error.message).toBe('Command manager cleared')
      }
    })

    it('should clear command queue', async () => {
      const promise1 = manager.sendCommand(mockPeripheral, 'ver', mockWriteToDevice).catch(() => {})
      const promise2 = manager.sendCommand(mockPeripheral, 'battery', mockWriteToDevice).catch(() => {})

      manager.clear()

      // Queue should be empty
      expect(mockWriteToDevice).toHaveBeenCalledTimes(1) // Only first command sent
      
      // Wait for promises to be rejected
      jest.advanceTimersByTime(0) // Ensure any immediately resolved/rejected promises process
      await Promise.all([promise1, promise2])
    })
  })
})
