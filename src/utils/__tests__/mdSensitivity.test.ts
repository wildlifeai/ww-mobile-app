import { mdSensitivityLevel } from '../mdSensitivity'

describe('mdSensitivityLevel', () => {
    it.each([
        ['low', 1],
        ['medium', 2],
        ['high', 3],
        [' High ', 3],
    ])('maps %p to op17 %p', (value, level) => {
        expect(mdSensitivityLevel(value)).toBe(level)
    })

    it.each([undefined, null, '', 'Unknown'])('falls back to medium for %p', (value) => {
        expect(mdSensitivityLevel(value)).toBe(2)
    })
})
