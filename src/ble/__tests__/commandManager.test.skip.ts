import { BleCommandManager } from '../commandManager'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { MessageType } from '../messageClassifier'

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: jest.fn(),
  logError: jest.fn(),
}))

describe.skip('BleCommandManager', () => {
  let manager: BleCommandManager
  let mockPeripheral: ExtendedPeripheral
  let mockWriteToDevice: jest.Mock

  beforeEach(() => {
    manager = new BleCommandManager()
    mockPeripheral = { id: 'test-device' } as ExtendedPeripheral
    mockWriteToDevice = jest.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    manager.clear()
  })

  describe('sendCommand', () => {
    it('should send command and wait for response', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'ver',
        mockWriteToDevice,
      )

      // Simulate device response
      setTimeout(() => {
        manager.handleIncomingMessage('WW500-C02 V 00.08.14')
      }, 10)

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

      await expect(commandPromise).rejects.toThrow('Command timeout after 100ms: ver')
    })

    it('should serialize multiple commands', async () => {
      const command1 = manager.sendCommand(mockPeripheral, 'ver', mockWriteToDevice)
      const command2 = manager.sendCommand(mockPeripheral, 'battery', mockWriteToDevice)

      // First command should be sent immediately
      expect(mockWriteToDevice).toHaveBeenCalledTimes(1)
      expect(mockWriteToDevice).toHaveBeenCalledWith(mockPeripheral, 'ver')

      // Respond to first command
      manager.handleIncomingMessage('WW500-C02 V 00.08.14')
      await command1

      // Second command should now be sent
      await new Promise(resolve => setTimeout(resolve, 10))
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

    it('should emit UNSOLICITED messages to listeners', (done) => {
      const unsubscribe = manager.onUnsolicitedMessage((msg) => {
        expect(msg.type).toBe(MessageType.UNSOLICITED)
        expect(msg.content).toBe('Wake')
        unsubscribe()
        done()
      })

      manager.handleIncomingMessage('Wake')
    })

    it('should handle ERROR messages', async () => {
      const commandPromise = manager.sendCommand(
        mockPeripheral,
        'AI info',
        mockWriteToDevice,
      )

      manager.handleIncomingMessage('AI NACK')

      // Should wait for wake sequence, but we'll timeout for this test
      await expect(commandPromise).rejects.toThrow()
    })
  })

  describe('waitForMessage', () => {
    it('should resolve when matching message received', async () => {
      const waitPromise = manager.waitForMessage(/Error bits = 0x/, 1000)

      setTimeout(() => {
        manager.handleIncomingMessage('Error bits = 0x0000')
      }, 10)

      const message = await waitPromise
      expect(message).toBe('Error bits = 0x0000')
    })

    it('should timeout if message not received', async () => {
      const waitPromise = manager.waitForMessage(/Error bits = 0x/, 100)

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
          type: MessageType.UNSOLICITED,
          content: 'Wake',
        }),
      )
      expect(callback2).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.UNSOLICITED,
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
      await Promise.allSettled([promise1, promise2])
    })
  })
})
