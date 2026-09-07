import {
    begin, settingsApplied, deviceWoke, deviceLine, transferProgress, imageSaved, failed,
    transferEta, describeTransfer, formatBytes, idleState, NOMINAL_RATE_BPS,
    CaptureStepsState,
} from '../captureSteps'

/**
 * The step list is the operator's only view of a device they cannot see
 * working, so each device line must land on the right step, and the countdown
 * must be honest about what it knows.
 */
describe('captureSteps', () => {
    const T0 = 1_000_000
    const status = (s: CaptureStepsState, key: string) => s.steps.find(x => x.key === key)?.status
    const detail = (s: CaptureStepsState, key: string) => s.steps.find(x => x.key === key)?.detail

    /** A run up to and including the byte count, the common prefix of most tests. */
    const throughBytesIn = () => {
        let s = settingsApplied(begin(), true)
        s = deviceLine(s, 'About to capture 1 image with an interval of \'500\' milliseconds', T0)
        s = deviceLine(s, 'AE light check: AGain = 0, conv=Y -> BRIGHT (change)', T0 + 900)
        s = deviceLine(s, 'Captured 1 images. Last is 592008A0.JPG (File write 51ms avg.)', T0 + 1500)
        s = deviceLine(s, '11818 bytes in 592008A0.JPG', T0 + 2000)
        return s
    }

    it('starts idle with every step pending and nothing running', () => {
        const s = idleState()
        expect(s.steps.map(x => x.status)).toEqual(['pending', 'pending', 'pending', 'pending'])
        expect(s.running).toBe(false)
    })

    it('a picture from a transfer this run did not start leaves the idle list alone', () => {
        // The reassembler is shared: a capture left running by a previous visit
        // completes while this one is idle, and must not tick its transfer step.
        expect(imageSaved(idleState(), T0)).toEqual(idleState())
    })

    it('begins on the settings step and moves to the capture once they are applied', () => {
        const s = begin()
        expect(status(s, 'settings')).toBe('active')
        const next = settingsApplied(s, false)
        expect(status(next, 'settings')).toBe('done')
        expect(detail(next, 'settings')).toBe('Already as chosen')
        expect(status(next, 'capture')).toBe('active')
    })

    it('lets the app say what it wrote, for the forced flash', () => {
        const s = settingsApplied(begin(), true, 'Written, flash forced on for this picture')
        expect(detail(s, 'settings')).toBe('Written, flash forced on for this picture')
    })

    it('walks the device\'s own lines through capture, light check and transfer', () => {
        const s = throughBytesIn()
        expect(status(s, 'capture')).toBe('done')
        expect(detail(s, 'capture')).toBe('592008A0.JPG')
        expect(status(s, 'light')).toBe('done')
        expect(detail(s, 'light')).toBe('Bright, no flash')
        expect(status(s, 'transfer')).toBe('active')
        expect(s.transfer).toEqual({ totalBytes: 11818, receivedBytes: 0, startedAt: T0 + 2000, lastAt: T0 + 2000 })
    })

    it('reads a dark verdict in either wording', () => {
        let s = settingsApplied(begin(), true)
        s = deviceLine(s, '[LS] AE light check: AGain = 4, conv=Y -> DARK', T0)
        expect(detail(s, 'light')).toBe('Dark, flash on')
        let t = settingsApplied(begin(), true)
        t = deviceLine(t, 'AE light check: mean AE = 40 (min 38, max 42) over 16 frames, threshold = 65 -> DARK (flash wanted)', T0)
        expect(detail(t, 'light')).toBe('Dark, flash on')
    })

    it('marks the light check as not needed when Captured arrives without one', () => {
        // Flash off and auto-switch off: the firmware runs no check.
        let s = settingsApplied(begin(), false)
        s = deviceLine(s, 'Captured 1 images. Last is 59200990.JPG (File write 51ms avg.)', T0)
        expect(status(s, 'light')).toBe('done')
        expect(detail(s, 'light')).toBe('Not needed, flash off')
    })

    it('notes the wake only while the capture is waiting for it', () => {
        const waiting = settingsApplied(begin(), true)
        expect(detail(deviceWoke(waiting), 'capture')).toBe('Camera awake')
        const done = throughBytesIn()
        expect(deviceWoke(done)).toBe(done)
    })

    it('ignores lines that mean nothing to it, and everything once not running', () => {
        const s = settingsApplied(begin(), true)
        expect(deviceLine(s, 'Error bits = 0x0000', T0)).toBe(s)
        const idle = idleState()
        expect(deviceLine(idle, 'Captured 1 images. Last is X.JPG', T0)).toBe(idle)
    })

    it('converts progress into bytes and counts down at the nominal rate before it can measure', () => {
        let s = throughBytesIn()
        s = transferProgress(s, 0.1, T0 + 3000) // 1182 bytes, below the measuring threshold
        expect(s.transfer?.receivedBytes).toBe(1182)
        const eta = transferEta(s.transfer!, T0 + 3000)
        expect(eta.rateBps).toBe(NOMINAL_RATE_BPS)
        expect(eta.seconds).toBe(Math.ceil((11818 - 1182) / NOMINAL_RATE_BPS))
    })

    it('measures the real rate once enough has arrived, and keeps counting between packets', () => {
        let s = throughBytesIn()
        s = transferProgress(s, 0.5, T0 + 7000) // 5909 bytes in 5 s = 1182 B/s
        const atPacket = transferEta(s.transfer!, T0 + 7000)
        expect(atPacket.rateBps).toBeCloseTo(1181.8, 0)
        expect(atPacket.seconds).toBe(5)
        const twoSecondsLater = transferEta(s.transfer!, T0 + 9000)
        expect(twoSecondsLater.seconds).toBe(3)
    })

    it('describes the transfer for a person', () => {
        let s = throughBytesIn()
        expect(describeTransfer(s.transfer!, T0 + 2000)).toBe('11.5 KB, about 11 s')
        s = transferProgress(s, 0.5, T0 + 7000)
        expect(describeTransfer(s.transfer!, T0 + 7000)).toBe('11.5 KB, about 5 s left')
        s = imageSaved(s, T0 + 12000)
        expect(describeTransfer(s.transfer!, T0 + 12000)).toBe('11.5 KB')
    })

    it('finishes on the saved image with the size and the time it took', () => {
        let s = throughBytesIn()
        s = deviceLine(s, 'Finished sending 11818 bytes (50 packets)', T0 + 12000)
        expect(detail(s, 'transfer')).toBe('Saving')
        s = imageSaved(s, T0 + 12300)
        expect(status(s, 'transfer')).toBe('done')
        expect(detail(s, 'transfer')).toBe('11.5 KB in 10.3 s')
        expect(s.running).toBe(false)
    })

    it('fails the step that was in progress, with the reason', () => {
        const s = failed(settingsApplied(begin(), true), 'TIMEOUT')
        expect(status(s, 'capture')).toBe('failed')
        expect(detail(s, 'capture')).toBe('TIMEOUT')
        expect(s.running).toBe(false)
    })

    it('formats sizes the way the transfer line does', () => {
        expect(formatBytes(512)).toBe('512 B')
        expect(formatBytes(11818)).toBe('11.5 KB')
    })
})
