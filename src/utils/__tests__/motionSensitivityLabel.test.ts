import { motionSensitivityLabel } from '../motionSensitivityLabel'

describe('motionSensitivityLabel (#575)', () => {
    it('capitalises the stored values', () => {
        expect(motionSensitivityLabel('low')).toBe('Low')
        expect(motionSensitivityLabel('medium')).toBe('Medium')
        expect(motionSensitivityLabel('high')).toBe('High')
    })

    it('leaves a capitalised value alone, and shows nothing as empty', () => {
        expect(motionSensitivityLabel('Unknown')).toBe('Unknown')
        expect(motionSensitivityLabel(null)).toBe('')
        expect(motionSensitivityLabel('')).toBe('')
    })
})
