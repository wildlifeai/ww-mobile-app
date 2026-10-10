import { SWEEP_DOWN, SWEEP_UP, SweepPoint, lensVerdict, parseDirSizes } from '../lensSweep'

/** The clean sweep from the bench, 6 October 2026: WILD-5WGJ, batteries in front of the lens. */
const BENCH_UP: Record<number, number> = {
    256: 29434, 384: 33776, 512: 41104, 640: 53964, 768: 40080, 896: 32872, 1023: 30903,
}

const sweep = (up: Record<number, number>, down: Record<number, number> = up): SweepPoint[] => [
    ...SWEEP_UP.map(position => ({ position, leg: 'up' as const, bytes: up[position] })),
    ...SWEEP_DOWN.map(position => ({ position, leg: 'down' as const, bytes: down[position] })),
]

describe('parseDirSizes', () => {
    it('reads the size of each file and skips the other lines', () => {
        const sizes = parseDirSizes([
            'Wake',
            'Error bits = 0x0000',
            '----A 2024-01-01, 00:02:46      19836 59201240.JPG',
            '----A 2024-01-01, 00:03:08      23644 592013c0.jpg',
            '0 dirs, 2 files.',
        ])
        expect([...sizes.entries()]).toEqual([['59201240.JPG', 19836], ['592013C0.JPG', 23644]])
    })
})

describe('lensVerdict', () => {
    it('passes the bench sweep, sharpest at 640', () => {
        const verdict = lensVerdict(sweep(BENCH_UP), null)
        expect(verdict.status).toBe('pass')
        expect(verdict.peakUp).toBe(640)
        expect(verdict.message).toMatch(/No reference unit yet/)
    })

    it('fails a stuck lens: the photos hardly change', () => {
        const flat = Object.fromEntries(SWEEP_UP.map(p => [p, 30000 + (p % 3) * 100]))
        expect(lensVerdict(sweep(flat), null)).toMatchObject({ status: 'fail', message: expect.stringMatching(/hardly change/) })
    })

    it('fails a lens pressed by its case: sharpest at the end of the range', () => {
        // The 5 October bench: the pressed lens still moved but peaked at 1023
        const pressed = { 256: 29000, 384: 30000, 512: 32000, 640: 35000, 768: 39000, 896: 43000, 1023: 46000 }
        expect(lensVerdict(sweep(pressed), null)).toMatchObject({ status: 'fail', peakUp: 1023 })
    })

    it('fails when going up and coming down disagree', () => {
        const down = { ...BENCH_UP, 640: 31000, 896: 56000 }
        expect(lensVerdict(sweep(BENCH_UP, down), null)).toMatchObject({ status: 'fail', message: expect.stringMatching(/disagree/) })
    })

    it('fails a peak far from the reference unit, passes one near it', () => {
        expect(lensVerdict(sweep(BENCH_UP), 384)).toMatchObject({ status: 'fail', message: expect.stringMatching(/expected near 384/) })
        expect(lensVerdict(sweep(BENCH_UP), 600)).toMatchObject({ status: 'pass', message: expect.stringMatching(/as expected/) })
    })

    it('fails a sweep that did not finish', () => {
        expect(lensVerdict(sweep(BENCH_UP).slice(0, 4), null).status).toBe('fail')
    })
})
