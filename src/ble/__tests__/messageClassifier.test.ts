import {
  classifyMessage,
  MessageType,
  isWakeMessage,
  isErrorBitsMessage,
  extractErrorBits,
  isAiNackError,
} from '../messageClassifier'

describe('Message Classifier', () => {
  describe('classifyMessage', () => {
    it('should classify Wake as INFO', () => {
      const result = classifyMessage('Wake')
      expect(result.type).toBe(MessageType.INFO)
      expect(result.content).toBe('Wake')
    })

    it('should classify Waking AI processor as INFO', () => {
      const result = classifyMessage('Waking AI processor.')
      expect(result.type).toBe(MessageType.INFO)
      expect(result.content).toBe('Waking AI processor.')
    })

    it('should classify AI processor is awake as INFO', () => {
      const result = classifyMessage('AI processor is awake.')
      expect(result.type).toBe(MessageType.INFO)
      expect(result.content).toBe('AI processor is awake.')
    })

    it('should classify Error bits message as INFO when 0x0000', () => {
      const result = classifyMessage('Error bits = 0x0000')
      expect(result.type).toBe(MessageType.INFO)
      expect(result.content).toBe('Error bits = 0x0000')
    })

    it('should classify AI NACK as ERROR', () => {
      const result = classifyMessage('AI NACK')
      expect(result.type).toBe(MessageType.ERROR)
      expect(result.errorType).toBe('AI_NACK')
    })

    it('should classify I2C error as ERROR', () => {
      const result = classifyMessage('I2C error: address NACK')
      expect(result.type).toBe(MessageType.ERROR)
      expect(result.errorType).toBe('I2C_ERROR')
    })

    it('should classify Discarding message as ERROR', () => {
      const result = classifyMessage('Discarding message as there is already one pending')
      expect(result.type).toBe(MessageType.ERROR)
      expect(result.errorType).toBe('I2C_ERROR')
    })

    it('should classify Sleep message as UNSOLICITED', () => {
      const result = classifyMessage('Sleep')
      expect(result.type).toBe(MessageType.UNSOLICITED)
    })

    it('should classify MD message as UNSOLICITED', () => {
      const result = classifyMessage('MD...')
      expect(result.type).toBe(MessageType.UNSOLICITED)
    })

    it('should classify Retrying transmission as UNSOLICITED', () => {
      const result = classifyMessage('Retrying transmission')
      expect(result.type).toBe(MessageType.UNSOLICITED)
    })

    it('should classify RTC set message as UNSOLICITED', () => {
      const result = classifyMessage('RTC set to 2026-01-29T11:30:00Z')
      expect(result.type).toBe(MessageType.UNSOLICITED)
    })

    it('should classify command response as RESPONSE when pattern matches', () => {
      const pattern = /^WW500-C\d{2} V/
      const result = classifyMessage('WW500-C02 V 00.08.14 15:55:48 Jan 26 2026', pattern)
      expect(result.type).toBe(MessageType.RESPONSE)
    })

    it('should classify unknown message as RESPONSE by default', () => {
      const result = classifyMessage('Some random device response')
      expect(result.type).toBe(MessageType.RESPONSE)
    })

    it('should include timestamp', () => {
      const before = Date.now()
      const result = classifyMessage('Wake')
      const after = Date.now()
      expect(result.timestamp).toBeGreaterThanOrEqual(before)
      expect(result.timestamp).toBeLessThanOrEqual(after)
    })

    it('should preserve raw message', () => {
      const raw = '  Wake  \n'
      const result = classifyMessage(raw)
      expect(result.raw).toBe(raw)
      expect(result.content).toBe('Wake')
    })
  })

  describe('isWakeMessage', () => {
    it('should return true for Wake', () => {
      expect(isWakeMessage('Wake')).toBe(true)
    })

    it('should return true for Waking AI processor', () => {
      expect(isWakeMessage('Waking AI processor.')).toBe(true)
    })

    it('should return true for AI processor is awake', () => {
      expect(isWakeMessage('AI processor is awake.')).toBe(true)
    })

    it('should return false for other messages', () => {
      expect(isWakeMessage('Error bits = 0x0000')).toBe(false)
      expect(isWakeMessage('Battery = 100%')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isWakeMessage('wake')).toBe(true)
      expect(isWakeMessage('WAKE')).toBe(true)
    })
  })

  describe('isErrorBitsMessage', () => {
    it('should return true for Error bits message', () => {
      expect(isErrorBitsMessage('Error bits = 0x0000')).toBe(true)
      expect(isErrorBitsMessage('Error bits = 0xABCD')).toBe(true)
    })

    it('should return false for other messages', () => {
      expect(isErrorBitsMessage('Wake')).toBe(false)
      expect(isErrorBitsMessage('Error bits')).toBe(false)
    })
  })

  describe('extractErrorBits', () => {
    it('should extract error bits value', () => {
      expect(extractErrorBits('Error bits = 0x0000')).toBe('0x0000')
      expect(extractErrorBits('Error bits = 0xABCD')).toBe('0xABCD')
      expect(extractErrorBits('Error bits = 0x1234')).toBe('0x1234')
    })

    it('should return null for non-error-bits messages', () => {
      expect(extractErrorBits('Wake')).toBeNull()
      expect(extractErrorBits('Battery = 100%')).toBeNull()
    })

    it('should be case insensitive', () => {
      expect(extractErrorBits('error bits = 0x0000')).toBe('0x0000')
    })
  })

  describe('isAiNackError', () => {
    it('should return true for AI NACK', () => {
      expect(isAiNackError('AI NACK')).toBe(true)
    })

    it('should return false for other messages', () => {
      expect(isAiNackError('Wake')).toBe(false)
      expect(isAiNackError('AI processor is awake')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isAiNackError('ai nack')).toBe(true)
      expect(isAiNackError('Ai Nack')).toBe(true)
    })
  })
})
