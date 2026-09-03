import { grabAeFields, EMPTY_AE } from '../aeRegisters'

/**
 * Two screens read the same register block; one parser means they cannot
 * disagree about it. The block may arrive as five lines or one.
 */
describe('grabAeFields', () => {
    it('lifts one field per line into a copy of the previous reading', () => {
        let ae = grabAeFields('  Integration time = 284 lines', null)
        expect(ae).toEqual({ ...EMPTY_AE, integration: '284' })
        ae = grabAeFields('  Analog gain = 4', ae)
        ae = grabAeFields('  Digital gain = 255', ae)
        ae = grabAeFields('  AE Mean = 24', ae)
        ae = grabAeFields('  AEConverged?: N', ae)
        expect(ae).toEqual({ integration: '284', analogGain: '4', digitalGain: '255', aeMean: '24', aeConverged: 'N' })
    })

    it('takes the whole block when the relay delivers it as one line', () => {
        const line = 'HM0360 AE regs:\n  Integration time = 376 lines\n  Analog gain = 0\n  Digital gain = 71\n  AE Mean = 72\n  AEConverged?: Y'
        expect(grabAeFields(line, null)).toEqual({ integration: '376', analogGain: '0', digitalGain: '71', aeMean: '72', aeConverged: 'Y' })
    })

    it('returns null for a line that carries no field, and leaves the previous reading alone', () => {
        const prev = { ...EMPTY_AE, aeMean: '72' }
        expect(grabAeFields('Captured 1 images. Last is X.JPG', prev)).toBeNull()
        expect(prev.aeMean).toBe('72')
    })

    it('does not mistake the decision line\'s analog gain wording for the register block', () => {
        // "AGain = 4" is the light check's own wording; the register block says "Analog gain = 4".
        expect(grabAeFields('AE light check: AGain = 4, conv=Y -> DARK', null)).toBeNull()
    })
})
