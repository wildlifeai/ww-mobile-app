import { parseLightCheck, summariseLightCheck } from '../lightCheck'

// The three wordings the firmware has used for this line. All three must parse,
// because which one a device sends depends on a compile-time flag the app
// cannot see, and a parser that only knew one of them turned a firmware
// rewording into a false "hardware problem" alert in September 2026.

/** dev firmware, spelled out in full. Console-only there; never sent to the app. */
const SPELLED_OUT =
    'AE light check: mean AE = 71 (min 71, max 71) over 16 frames, threshold = 65, ' +
    'analog gain = 4, converged = no, gain railed = yes -> DARK (flash wanted) (changed)'

/** ae_review, mean-based algorithm (AE_DECISION_GAIN_BASED undefined). */
const ABBREVIATED =
    'AE light check: mean AE=77 (min 75, max 80, 16 frames) thr=65, AGain=0, conv=Y, gain railed = N -> BRIGHT'

/** ae_review, gain-based algorithm (the default). No mean, no threshold. */
const GAIN_BASED = 'AE light check: AGain = 3, conv=N -> DARK (change)'

describe('parseLightCheck', () => {
    it('parses every field of the spelled-out line', () => {
        expect(parseLightCheck(SPELLED_OUT)).toMatchObject({
            dark: true,
            meanAE: 71,
            threshold: 65,
            minAE: 71,
            maxAE: 71,
            frames: 16,
            analogGain: 4,
            converged: false,
            gainRailed: true,
            changed: true,
        })
    })

    it('parses the abbreviated mean-based line', () => {
        // `thr=`, `AGain=`, `conv=Y`, `gain railed = N`, and the frame count
        // inside the parentheses rather than after them.
        expect(parseLightCheck(ABBREVIATED)).toMatchObject({
            dark: false,
            meanAE: 77,
            threshold: 65,
            minAE: 75,
            maxAE: 80,
            frames: 16,
            analogGain: 0,
            converged: true,
            gainRailed: false,
            changed: false,
        })
    })

    it('parses the gain-based line, which has no mean and no threshold', () => {
        const r = parseLightCheck(GAIN_BASED)!
        expect(r.dark).toBe(true)
        expect(r.analogGain).toBe(3)
        expect(r.converged).toBe(false)
        expect(r.changed).toBe(true)
        // Absent, not zero: this algorithm never reads op23, and a threshold of
        // 0 in a log row would be a number someone might try to interpret.
        expect(r.meanAE).toBeNull()
        expect(r.threshold).toBeNull()
        expect(r.minAE).toBeNull()
        expect(r.frames).toBeNull()
        expect(r.gainRailed).toBeNull()
    })

    it('keeps the line as received', () => {
        expect(parseLightCheck(`  ${GAIN_BASED}  `)?.raw).toBe(GAIN_BASED)
    })

    // Forward tolerance: the algorithm is still changing, so fields the app has
    // never seen are expected to appear and must not break the fields it knows.
    it('ignores fields it has never seen and keeps the rest', () => {
        const r = parseLightCheck(
            'AE light check: AGain = 3, conv=N, lux estimate = 3.2, sensor temp = 19 -> DARK',
        )!
        expect(r.dark).toBe(true)
        expect(r.analogGain).toBe(3)
    })

    it('tolerates the [LS] console prefix, so bench logs parse too', () => {
        expect(parseLightCheck(`[LS] ${ABBREVIATED}`)?.meanAE).toBe(77)
        expect(parseLightCheck(`[LS] ${GAIN_BASED}`)?.dark).toBe(true)
    })

    // The trap that made the verdict a required field in the first place: this
    // line shares the prefix, is printed during the capture phase, and carries
    // no reading at all. Requiring `-> DARK|BRIGHT` is what keeps it out.
    it('does not match the "Skipping NN processing" line', () => {
        expect(parseLightCheck('[LS] Skipping NN processing (AE light check).')).toBeNull()
    })

    it('returns null without a verdict, whatever else the line carries', () => {
        expect(parseLightCheck('AE light check: mean AE=71 (min 71, max 71, 16 frames) thr=65')).toBeNull()
        expect(parseLightCheck('AE light check: AGain = 3, conv=N')).toBeNull()
    })

    it('returns null for unrelated device output', () => {
        expect(parseLightCheck('HM0360 AE regs:')).toBeNull()
        expect(parseLightCheck('  AE Mean = 71')).toBeNull()
        expect(parseLightCheck('Checking light level...')).toBeNull()
        expect(parseLightCheck('')).toBeNull()
    })
})

describe('summariseLightCheck', () => {
    it('names the verdict and whichever inputs the wording carried', () => {
        expect(summariseLightCheck(parseLightCheck(ABBREVIATED)!)).toBe('BRIGHT, mean 77 vs 65, gain 0')
        expect(summariseLightCheck(parseLightCheck(GAIN_BASED)!)).toBe('DARK, gain 3, not converged, changed')
        expect(summariseLightCheck(parseLightCheck(SPELLED_OUT)!))
            .toBe('DARK, mean 71 vs 65, gain 4, not converged, gain railed, changed')
    })

    it('can leave the verdict out for a row that prints it separately', () => {
        // The screen's Device row printed "DARK, DARK, gain 3" before this.
        expect(summariseLightCheck(parseLightCheck(GAIN_BASED)!, { verdict: false }))
            .toBe('gain 3, not converged, changed')
        expect(summariseLightCheck(parseLightCheck('AE light check: -> BRIGHT')!, { verdict: false }))
            .toBe('no details sent')
    })
})
