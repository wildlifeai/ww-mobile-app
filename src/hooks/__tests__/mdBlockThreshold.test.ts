import { OP_PARAMETER, mdBlockThresholdOf } from '../useDeviceSettings'

/** An op table of the given length, op33 as given, everything else 0. */
const table = (length: number, op33: string): string[] =>
    Array.from({ length }, (_, i) => (i === OP_PARAMETER.MD_BLOCK_THRESHOLD ? op33 : '0'))

/**
 * op33 is the motion wake threshold on the firmware of Seeed PR #276 (1-255,
 * default 4), reserved and reported as 0 before it, and MD_BLOCK_NUM_MAX on
 * firmware before ae_review, which has no op34. The reset, the verification and
 * the motion test all ask this one function which of the three a device runs.
 */
describe('mdBlockThresholdOf', () => {
    it.each(['1', '4', '255'])('reads a threshold of %s', (op33) => {
        expect(mdBlockThresholdOf(table(37, op33))).toBe(Number(op33))
    })

    it.each([
        ['firmware that reserves op33', table(37, '0')],
        ['a value out of range', table(37, '256')],
        ['a value that is not a number', table(37, 'x')],
        ['firmware before ae_review, where op33 was MD_BLOCK_NUM_MAX', table(34, '4')],
        ['a table too short to have op33', table(23, '0')],
        ['no op table', null],
    ])('reports no threshold for %s', (_why, ops) => {
        expect(mdBlockThresholdOf(ops)).toBeNull()
    })
})
