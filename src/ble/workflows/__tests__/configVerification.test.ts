import { verifyConfigDefaults } from '../configVerification'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../../hooks/useDeviceSettings'

/** A device at every factory default, with op33 as given. */
const sessionWith = (op33: string) => {
    const ops = Array.from({ length: 37 }, (_, i) => (FACTORY_DEFAULTS[i] ?? 0).toString())
    ops[OP_PARAMETER.MD_BLOCK_THRESHOLD] = op33
    return { execute: jest.fn(async () => ops) } as any
}

/**
 * After a firmware update the op table is compared with FACTORY_DEFAULTS.
 * The default for op33 became 4 with Seeed PR #276, and firmware before it
 * reports 0 there, so op33 is compared only where the firmware has the
 * threshold.
 */
describe('verifyConfigDefaults op33', () => {
    it('does not report op33 = 0 on firmware without the motion wake threshold', async () => {
        const result = await verifyConfigDefaults(sessionWith('0'))

        expect(result.verified).toBe(true)
        expect(result.mismatches[OP_PARAMETER.MD_BLOCK_THRESHOLD]).toBeUndefined()
    })

    it('reports a threshold that is not the default', async () => {
        const result = await verifyConfigDefaults(sessionWith('9'))

        expect(result.verified).toBe(false)
        expect(result.mismatches[OP_PARAMETER.MD_BLOCK_THRESHOLD]).toEqual({ expected: 4, actual: '9' })
    })
})
