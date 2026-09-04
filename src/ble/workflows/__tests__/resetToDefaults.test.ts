import { executeResetToDefaults } from '../resetToDefaults'
import { FACTORY_DEFAULTS, OP_PARAMETER, RESET_PRESERVED_OPS } from '../../../hooks/useDeviceSettings'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

/**
 * The reset's return value is what the next step configures against. Before it
 * existed, `configureDevice` diffed against the snapshot taken BEFORE the
 * reset, so any parameter whose old value happened to match what the
 * deployment wanted was skipped, leaving the device on the factory default the
 * reset had just written (#282).
 */
describe('executeResetToDefaults resulting ops', () => {
    /** A device that answers every setop, recording what it was asked to write. */
    const makeSession = () => {
        const writes: string[] = []
        return {
            writes,
            execute: jest.fn(async (build: any) => {
                const command = typeof build === 'function' ? build() : build
                writes.push(command?.build?.() ?? '')
                return true
            }),
        }
    }

    /** An op table of the given length, every entry deliberately off-default. */
    const opTable = (length: number, overrides: Record<number, string> = {}) => {
        const ops = Array.from({ length }, (_, index) => {
            const factory = FACTORY_DEFAULTS[index]
            return factory === undefined ? '0' : (factory + 7).toString()
        })
        Object.entries(overrides).forEach(([index, value]) => { ops[Number(index)] = value })
        return ops
    }

    it('reports the factory defaults it wrote', async () => {
        const session = makeSession()
        const currentOps = opTable(37)

        const result = await executeResetToDefaults(session as any, {
            currentOps,
            skipIdentityReset: true,
        })

        expect(result).not.toBeNull()
        expect(result![OP_PARAMETER.FLASH_LED]).toBe(FACTORY_DEFAULTS[OP_PARAMETER.FLASH_LED].toString())
        expect(result![OP_PARAMETER.FLASH_MODE]).toBe(FACTORY_DEFAULTS[OP_PARAMETER.FLASH_MODE].toString())
        expect(result![OP_PARAMETER.TIMELAPSE_INTERVAL]).toBe(FACTORY_DEFAULTS[OP_PARAMETER.TIMELAPSE_INTERVAL].toString())
    })

    it('keeps the value the reset deliberately left alone', async () => {
        const session = makeSession()
        // Image counters are preserved, so the deployment must still see them.
        const currentOps = opTable(37, { [OP_PARAMETER.IMAGES_COUNT]: '412' })

        const result = await executeResetToDefaults(session as any, {
            currentOps,
            skipIdentityReset: true,
        })

        expect(RESET_PRESERVED_OPS.has(OP_PARAMETER.IMAGES_COUNT)).toBe(true)
        expect(result![OP_PARAMETER.IMAGES_COUNT]).toBe('412')
    })

    it('keeps the model the deployment just loaded', async () => {
        const session = makeSession()
        const currentOps = opTable(37, {
            [OP_PARAMETER.MODEL_PROJECT]: '3',
            [OP_PARAMETER.MODEL_VERSION]: '9',
        })

        const result = await executeResetToDefaults(session as any, {
            currentOps,
            skipIdentityReset: true,
            preserveModel: true,
        })

        expect(result![OP_PARAMETER.MODEL_PROJECT]).toBe('3')
        expect(result![OP_PARAMETER.MODEL_VERSION]).toBe('9')
    })

    it('leaves parameters a shorter firmware does not report out of the result', async () => {
        const session = makeSession()
        const currentOps = opTable(23)

        const result = await executeResetToDefaults(session as any, {
            currentOps,
            skipIdentityReset: true,
        })

        expect(result).toHaveLength(23)
    })

    it('returns null when the ops could not be read, so callers keep their own view', async () => {
        const session = makeSession()

        const result = await executeResetToDefaults(session as any, {
            currentOps: null,
            skipIdentityReset: true,
        })

        expect(result).toBeNull()
    })
})
