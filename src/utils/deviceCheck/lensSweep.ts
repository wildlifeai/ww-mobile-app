/**
 * lensSweep: does the RP3 focus lens move, and is it sharpest where a free lens
 * should be?
 *
 * The device check moves the lens with `AI vcm <position>`, takes one photo at
 * each position and reads the file sizes back with `AI dir`. A sharper photo
 * holds more detail, so it compresses less and its JPEG is bigger: on the
 * bench (6 October 2026, WILD-5WGJ, printed batteries in front of the lens) the
 * file size peaked at the same position as a Laplacian sharpness score
 * computed from the downloaded photos, correlation 0.92 across the sweep. Using
 * the size means none of the sweep's photos has to cross Bluetooth, which runs
 * at about 1.1 KB/s.
 *
 * The rules come from `_Tools/lens_test.py` in the firmware repo, which scores
 * the same sweep from the console stream, plus a window around the reference
 * unit's peak: a lens pressed by its case still moved on the bench (5 October
 * 2026) but peaked at 1023 instead of 512, so "it moved" is not enough.
 */

/**
 * Lens positions, up then back down. Below about 300 the lens did not move at
 * all on the bench (0, 128 and 256 gave the same photo to within 0.2%), so the
 * sweep starts at 256 and spends its photos where the lens travels.
 */
export const SWEEP_UP = [256, 384, 512, 640, 768, 896, 1023]
export const SWEEP_DOWN = [896, 768, 640, 512, 384, 256]

/** The largest file must be at least this many times the smallest. The bench sweep gave 1.83. */
export const MIN_SIZE_RATIO = 1.2
/** The two legs may differ by this much on average, as a fraction of the larger. */
export const MAX_LEG_DIFFERENCE = 0.15
/** The two legs' peaks, and the peak against the reference unit's, may differ by this many steps. */
export const PEAK_TOLERANCE = 128

export interface SweepPoint {
    position: number
    leg: 'up' | 'down'
    /** Photo file size in bytes, from `AI dir` */
    bytes: number
}

export type LensVerdict =
    | { status: 'pass'; peakUp: number; peakDown: number; ratio: number; message: string }
    | { status: 'fail'; peakUp?: number; peakDown?: number; ratio?: number; message: string }

/**
 * `AI dir` lines as file name to size. A line reads
 * `----A 2024-01-01, 00:02:46      19836 59201240.JPG`; anything else the
 * device says while answering (Wake, the self-test line) is skipped.
 */
export const parseDirSizes = (lines: string[]): Map<string, number> => {
    const sizes = new Map<string, number>()
    for (const line of lines) {
        const m = /^\s*[-DRSHA]{5}\s+\d{4}-\d{2}-\d{2},\s+\d{2}:\d{2}:\d{2}\s+(\d+)\s+(\S+)\s*$/.exec(line)
        if (m) sizes.set(m[2].toUpperCase(), parseInt(m[1], 10))
    }
    return sizes
}

const peakOf = (points: SweepPoint[]): number =>
    points.reduce((best, p) => (p.bytes > best.bytes ? p : best)).position

/**
 * The verdict on a sweep, in the operator's words. `reference` is the peak a
 * known-good unit gave in the same fixture; without one, the check can only
 * say the lens moves and is not stuck at an end.
 */
export const lensVerdict = (points: SweepPoint[], reference: number | null): LensVerdict => {
    const up = points.filter(p => p.leg === 'up')
    const down = points.filter(p => p.leg === 'down')
    if (up.length < 3 || down.length < 3) {
        return { status: 'fail', message: 'The sweep did not finish, so the lens could not be judged.' }
    }

    const sizes = points.map(p => p.bytes)
    const ratio = Math.max(...sizes) / Math.max(1, Math.min(...sizes))
    const peakUp = peakOf(up)
    const peakDown = peakOf(down)
    const ends = [SWEEP_UP[0], SWEEP_UP[SWEEP_UP.length - 1]]

    if (ratio < MIN_SIZE_RATIO) {
        return {
            status: 'fail', peakUp, peakDown, ratio,
            message: `The photos hardly change across the lens range (${ratio.toFixed(2)}x). Either the lens is stuck, or the card is not in front of the camera.`,
        }
    }
    if (ends.includes(peakUp) || ends.includes(peakDown)) {
        return {
            status: 'fail', peakUp, peakDown, ratio,
            message: `The lens moves, but the photo is sharpest at the end of its range (${peakUp} going up, ${peakDown} coming down). The case may be pressing on the lens: reseat the camera module and run again.`,
        }
    }

    const common = up.filter(u => down.some(d => d.position === u.position))
    const difference = common.reduce((sum, u) => {
        const d = down.find(p => p.position === u.position)!
        return sum + Math.abs(u.bytes - d.bytes) / Math.max(u.bytes, d.bytes)
    }, 0) / Math.max(1, common.length)
    if (difference > MAX_LEG_DIFFERENCE || Math.abs(peakUp - peakDown) > PEAK_TOLERANCE) {
        return {
            status: 'fail', peakUp, peakDown, ratio,
            message: `Going up and coming down disagree (sharpest at ${peakUp} and ${peakDown}). The lens may be catching, or the camera or card moved. Keep both still and run again.`,
        }
    }

    if (reference !== null && Math.abs(peakUp - reference) > PEAK_TOLERANCE) {
        return {
            status: 'fail', peakUp, peakDown, ratio,
            message: `Sharpest at ${peakUp}, expected near ${reference}. The case may be pressing on the lens: reseat the camera module and run again.`,
        }
    }

    return {
        status: 'pass', peakUp, peakDown, ratio,
        message: reference === null
            ? `The lens moves freely and is sharpest at ${peakUp}. No reference unit yet to compare with.`
            : `The lens moves freely and is sharpest at ${peakUp}, as expected.`,
    }
}
