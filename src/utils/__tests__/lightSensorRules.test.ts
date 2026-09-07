import {
    scoreByMean,
    scoreByGain,
    toRegisterReading,
    describeGainRule,
    describeMeanRule,
    verdictLabel,
    DEFAULT_DARK_ANALOG_GAIN_THRESHOLD,
    FIRMWARE_HYSTERESIS,
} from '../lightSensorRules'

const reading = (over: Partial<ReturnType<typeof toRegisterReading>> = {}) => ({
    aeMean: 71,
    analogGain: 0,
    digitalGain: 64,
    integration: 87,
    converged: true,
    ...over,
})

describe('toRegisterReading', () => {
    it('converts the strings the BLE listener collects', () => {
        expect(toRegisterReading({
            aeMean: '24', analogGain: '4', digitalGain: '255', integration: '284', aeConverged: 'N',
        })).toEqual({ aeMean: 24, analogGain: 4, digitalGain: 255, integration: 284, converged: false })
    })

    it('returns null with no usable mean, since nothing can be scored', () => {
        expect(toRegisterReading({ aeMean: '' })).toBeNull()
        expect(toRegisterReading({ aeMean: 'abc' })).toBeNull()
    })

    it('reads missing registers as unknown rather than as a number', () => {
        // A half-arrived block must not score the gain rule on gain 0.
        const r = toRegisterReading({ aeMean: '24' })!
        expect(r.analogGain).toBeNull()
        expect(r.converged).toBeNull()
        expect(scoreByGain(r)).toBeNull()
    })
})

describe('scoreByMean', () => {
    it('is dark below the threshold and bright at or above it', () => {
        expect(scoreByMean(reading({ aeMean: 64 }), 65)).toBe(true)
        expect(scoreByMean(reading({ aeMean: 65 }), 65)).toBe(false)
        expect(scoreByMean(reading({ aeMean: 80 }), 65)).toBe(false)
    })

    it('holds the previous verdict inside the hysteresis band', () => {
        // The firmware's dead band: 65 to 77 with the shipped value of 12.
        const inBand = reading({ aeMean: 70 })
        expect(scoreByMean(inBand, 65, { hysteresis: FIRMWARE_HYSTERESIS, previousDark: true })).toBe(true)
        expect(scoreByMean(inBand, 65, { hysteresis: FIRMWARE_HYSTERESIS, previousDark: false })).toBe(false)
        expect(scoreByMean(reading({ aeMean: 77 }), 65, { hysteresis: FIRMWARE_HYSTERESIS, previousDark: true })).toBe(false)
    })

    it('falls back to a plain threshold with no previous verdict', () => {
        // The first reading of a session has nothing to hold on to.
        expect(scoreByMean(reading({ aeMean: 70 }), 65, { hysteresis: FIRMWARE_HYSTERESIS, previousDark: null })).toBe(false)
    })
})

describe('scoreByGain', () => {
    it('is dark above the analog gain threshold', () => {
        expect(scoreByGain(reading({ analogGain: 3 }))).toBe(true)
        expect(scoreByGain(reading({ analogGain: DEFAULT_DARK_ANALOG_GAIN_THRESHOLD }))).toBe(false)
        expect(scoreByGain(reading({ analogGain: 0 }))).toBe(false)
    })

    it('is dark when the AE loop has not converged, whatever the gain', () => {
        expect(scoreByGain(reading({ analogGain: 0, converged: false }))).toBe(true)
    })

    it('takes a different gain threshold', () => {
        expect(scoreByGain(reading({ analogGain: 3 }), 3)).toBe(false)
        expect(scoreByGain(reading({ analogGain: 4 }), 3)).toBe(true)
    })
})

describe('rule descriptions', () => {
    it('describe the mean rule with the number the operator sees', () => {
        expect(describeMeanRule(reading({ aeMean: 24 }), 65)).toBe('24 below 65')
        expect(describeMeanRule(reading({ aeMean: 80 }), 65)).toBe('80 at or above 65')
    })

    it('describe the gain rule by whichever clause fired', () => {
        expect(describeGainRule(reading({ analogGain: 4 }))).toBe('gain 4 above 2')
        expect(describeGainRule(reading({ analogGain: 1, converged: false }))).toBe('not converged, gain 1')
        expect(describeGainRule(reading({ analogGain: 0 }))).toBe('gain 0, converged')
        expect(describeGainRule(reading({ analogGain: null }))).toBe('gain or convergence not reported')
    })

    it('labels a missing verdict as such rather than as bright', () => {
        expect(verdictLabel(null)).toBe('no verdict')
        expect(verdictLabel(undefined)).toBe('no verdict')
        expect(verdictLabel(true)).toBe('DARK')
        expect(verdictLabel(false)).toBe('BRIGHT')
    })
})
