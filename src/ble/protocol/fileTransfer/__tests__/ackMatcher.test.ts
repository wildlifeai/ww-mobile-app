import { matchAck } from '../ackMatcher'

describe('ackMatcher', () => {
  // ─── START phase ─────────────────────────────────────────────
  describe('START phase', () => {
    const expected = { phase: 'start' as const }

    it('accepts "ftx ack 0"', () => {
      const result = matchAck('ftx ack 0', expected)
      expect(result.type).toBe('accept')
    })

    it('rejects ftx error', () => {
      const result = matchAck('ftx err 3', expected)
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(3)
    })

    it('ignores wrong ack number', () => {
      const result = matchAck('ftx ack 5', expected)
      expect(result.type).toBe('ignore')
    })

    it('ignores non-ftx line', () => {
      const result = matchAck('Battery = 3305mV 100%', expected)
      expect(result.type).toBe('ignore')
    })

    it('ignores ftx done during start phase', () => {
      const result = matchAck('ftx done', expected)
      expect(result.type).toBe('ignore')
    })
  })

  // ─── DATA phase ──────────────────────────────────────────────
  describe('DATA phase', () => {
    it('accepts correct packet number', () => {
      const result = matchAck('ftx ack 42', { phase: 'data', packetNum: 42 })
      expect(result.type).toBe('accept')
    })

    it('ignores wrong packet number', () => {
      const result = matchAck('ftx ack 41', { phase: 'data', packetNum: 42 })
      expect(result.type).toBe('ignore')
    })

    it('rejects ftx error', () => {
      const result = matchAck('ftx err 4', { phase: 'data', packetNum: 1 })
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(4)
    })

    it('ignores duplicate ACK for already-processed packet', () => {
      const result = matchAck('ftx ack 5', { phase: 'data', packetNum: 6 })
      expect(result.type).toBe('ignore')
    })

    it('ignores unexpected ftx done during DATA phase', () => {
      const result = matchAck('ftx done', { phase: 'data', packetNum: 10 })
      expect(result.type).toBe('ignore')
    })

    it('ignores ftx ack 0 after transfer already started', () => {
      const result = matchAck('ftx ack 0', { phase: 'data', packetNum: 1 })
      expect(result.type).toBe('ignore')
    })

    it('handles packet number wrap: ack 1 after expecting 1 (after 255)', () => {
      const result = matchAck('ftx ack 1', { phase: 'data', packetNum: 1 })
      expect(result.type).toBe('accept')
    })

    it('handles high packet number 255', () => {
      const result = matchAck('ftx ack 255', { phase: 'data', packetNum: 255 })
      expect(result.type).toBe('accept')
    })

    it('ignores non-ftx lines (device logs)', () => {
      const result = matchAck('motion detected', { phase: 'data', packetNum: 1 })
      expect(result.type).toBe('ignore')
    })
  })

  // ─── END phase ───────────────────────────────────────────────
  describe('END phase', () => {
    const expected = { phase: 'end' as const }

    it('accepts "ftx done"', () => {
      const result = matchAck('ftx done', expected)
      expect(result.type).toBe('accept')
    })

    it('rejects ftx error', () => {
      const result = matchAck('ftx err 5', expected)
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(5)
    })

    it('ignores ftx ack during end phase', () => {
      const result = matchAck('ftx ack 42', expected)
      expect(result.type).toBe('ignore')
    })

    it('ignores non-ftx lines', () => {
      const result = matchAck('Sleep', expected)
      expect(result.type).toBe('ignore')
    })
  })

  // ─── Error extraction ────────────────────────────────────────
  describe('error code extraction', () => {
    it('extracts error code 1 (wrong state)', () => {
      const result = matchAck('ftx err 1', { phase: 'data', packetNum: 1 })
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(1)
    })

    it('extracts error code 4 (I2C fail)', () => {
      const result = matchAck('ftx err 4', { phase: 'start' })
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(4)
    })

    it('extracts HX6538 error codes (5+)', () => {
      const result = matchAck('ftx err 7', { phase: 'data', packetNum: 5 })
      expect(result.type).toBe('error')
      expect((result as any).code).toBe(7)
    })

    it('aborts on error between valid ACKs', () => {
      // Simulate: got ack 1, then err, expecting ack 2
      const result = matchAck('ftx err 4', { phase: 'data', packetNum: 2 })
      expect(result.type).toBe('error')
    })
  })

  // ─── Whitespace handling ─────────────────────────────────────
  describe('whitespace handling', () => {
    it('trims leading/trailing whitespace', () => {
      const result = matchAck('  ftx ack 0  ', { phase: 'start' })
      expect(result.type).toBe('accept')
    })

    it('trims ftx done with whitespace', () => {
      const result = matchAck('  ftx done  ', { phase: 'end' })
      expect(result.type).toBe('accept')
    })
  })
})
