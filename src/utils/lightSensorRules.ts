/**
 * The app's own dark/bright rules, scored from the raw HM0360 AE registers.
 *
 * The firmware picks its algorithm at compile time (`AE_DECISION_GAIN_BASED` in
 * lightSensor.c), which the app can neither see nor change. What the app can
 * see is the five-register block every firmware sends after every capture and
 * every light check, and those registers are the inputs to every candidate
 * rule. So rather than trust one verdict, the app scores the same reading by
 * each rule and records all of them, and a bench run answers "which rule would
 * have been right here" without a reflash.
 *
 * These rules are for evaluation. What the *device* does in the field is still
 * decided by the firmware, and choosing that at runtime needs a new operational
 * parameter, agreed across repos.
 *
 * Both rules and their constants come from the roadmap's analysis of 303 frames
 * across three day/night cycles (`_Documentation/AE_Light_Sensor_Roadmap.md` in
 * the Seeed repo): analog gain above 2 separated dark from light in 99.7% of
 * frames, mean AE below 56 in 96.7%.
 */

/**
 * `DARK_ANALOG_GAIN_THRESHOLD` in lightSensor.c: analog gain above this means
 * the AE loop has run out of exposure and digital gain to spend.
 */
export const DEFAULT_DARK_ANALOG_GAIN_THRESHOLD = 2

/**
 * `AE_HYSTERESIS` as the firmware shipped it. The September 2026 review branch
 * sets it to 0 while Seeed#204 is decided, so a comparison against "the old
 * algorithm" needs to say which value it means.
 */
export const FIRMWARE_HYSTERESIS = 12

/** The AE registers as numbers. `aeMean` is the only one every reading has. */
export interface RegisterReading {
    /** AE_MEAN, 0-255, the sensor's own average scene brightness */
    aeMean: number
    /** ANALOG_GAIN, 0-7 */
    analogGain: number | null
    /** DIGITAL_GAIN, 0-255 */
    digitalGain: number | null
    /** Coarse integration time in lines */
    integration: number | null
    /** AE_CONVERGED bit */
    converged: boolean | null
}

/**
 * Turn the string fields the BLE listener collects into a reading, or null when
 * there is no usable mean. Other fields become null rather than NaN so a
 * missing register reads as "unknown" downstream, not as a number.
 */
export const toRegisterReading = (fields: {
    aeMean: string
    analogGain?: string
    digitalGain?: string
    integration?: string
    aeConverged?: string
}): RegisterReading | null => {
    const aeMean = parseInt(fields.aeMean, 10)
    if (isNaN(aeMean)) return null
    const int = (s?: string): number | null => {
        if (s === undefined || s === '') return null
        const v = parseInt(s, 10)
        return isNaN(v) ? null : v
    }
    const yn = (s?: string): boolean | null => {
        if (!s) return null
        if (/^y/i.test(s)) return true
        if (/^n/i.test(s)) return false
        return null
    }
    return {
        aeMean,
        analogGain: int(fields.analogGain),
        digitalGain: int(fields.digitalGain),
        integration: int(fields.integration),
        converged: yn(fields.aeConverged),
    }
}

export interface MeanRuleOptions {
    /** Width of the dead band above the threshold. 0 disables it */
    hysteresis?: number
    /**
     * The previous verdict, which is what the dead band holds on to. With no
     * previous verdict the band cannot apply and the rule is a plain threshold.
     */
    previousDark?: boolean | null
}

/**
 * The mean-based rule, as `decideDarkBright()` applies it: dark below the
 * threshold, bright at or above threshold plus hysteresis, and inside the band
 * whatever it decided last time.
 *
 * The firmware also forces DARK when both gains sit at their ceiling. The
 * ceilings are sensor registers the app never reads, so that clause is not
 * reproduced here; a railed frame still scores dark on the mean in practice,
 * since a railed sensor is one that could not get the mean up.
 */
export const scoreByMean = (reading: RegisterReading, threshold: number, opts: MeanRuleOptions = {}): boolean => {
    const hysteresis = opts.hysteresis ?? 0
    const previous = opts.previousDark ?? null
    if (reading.aeMean < threshold) return true
    if (hysteresis > 0 && previous !== null && reading.aeMean < threshold + hysteresis) return previous
    return false
}

/**
 * The gain-based rule, as `decideDarkBrightGainBased()` applies it: dark when
 * the AE loop has not converged, or when analog gain is above the threshold.
 * Null when the reading lacks either input, since a guess here would be logged
 * as a verdict.
 */
export const scoreByGain = (
    reading: RegisterReading,
    gainThreshold: number = DEFAULT_DARK_ANALOG_GAIN_THRESHOLD,
): boolean | null => {
    if (reading.analogGain === null || reading.converged === null) return null
    return !reading.converged || reading.analogGain > gainThreshold
}

/** "24 below 65" or "80 above 65", for the line under the verdict. */
export const describeMeanRule = (reading: RegisterReading, threshold: number): string =>
    reading.aeMean < threshold
        ? `${reading.aeMean} below ${threshold}`
        : `${reading.aeMean} at or above ${threshold}`

/** "gain 4 above 2", "not converged", or "gain 0, converged". */
export const describeGainRule = (
    reading: RegisterReading,
    gainThreshold: number = DEFAULT_DARK_ANALOG_GAIN_THRESHOLD,
): string => {
    if (reading.analogGain === null || reading.converged === null) return 'gain or convergence not reported'
    if (!reading.converged) return `not converged, gain ${reading.analogGain}`
    return reading.analogGain > gainThreshold
        ? `gain ${reading.analogGain} above ${gainThreshold}`
        : `gain ${reading.analogGain}, converged`
}

export const verdictLabel = (dark: boolean | null | undefined): string =>
    dark === null || dark === undefined ? 'no verdict' : dark ? 'DARK' : 'BRIGHT'
