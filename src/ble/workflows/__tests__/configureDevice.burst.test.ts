import { configureDevice } from '../deploymentPipeline'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

/**
 * What Start Monitoring hands the configuration step for the project's burst,
 * and what the deployment log says about it, the op8 written included (#317).
 * The op writes themselves are pinned in useDeploymentConfiguration.test.ts.
 */
describe('configureDevice burst', () => {
    const baseConfig = {
        deploymentId: 'd',
        captureMethodId: 1,
        timelapseInterval: 300,
        recordGpsInImages: false,
    }

    const run = async (config: Partial<Parameters<typeof configureDevice>[2]>) => {
        const startConfigure = jest.fn(async () => {})
        const addLog = jest.fn()
        await configureDevice(
            { id: 'AA:BB' } as any,
            startConfigure,
            { ...baseConfig, ...config },
            { addLog, setStep: jest.fn(), setProgress: jest.fn() },
            ['0'],
        )
        return { startConfigure, logs: addLog.mock.calls.map(call => call[0] as string) }
    }

    it('passes the project burst through and logs it', async () => {
        const burst = { photos_per_trigger: 3, photo_interval_milliseconds: 1000 }

        const { startConfigure, logs } = await run({ burst })

        expect(startConfigure).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ burst, recordRawBmp: undefined }),
            ['0'],
        )
        expect(logs).toContain('Pictures per trigger: 3, 1000 ms apart (awake 2000 ms)')
    })

    it('passes the raw BMP flag through, so op5 is doubled there', async () => {
        const { startConfigure } = await run({ burst: { photos_per_trigger: 2 }, recordRawBmp: true })

        expect(startConfigure).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ recordRawBmp: true }),
            ['0'],
        )
    })

    it('logs the op8 the burst writes, which outlasts the interval', async () => {
        const { logs } = await run({ burst: { photos_per_trigger: 3, photo_interval_milliseconds: 2000 } })

        expect(logs).toContain('Pictures per trigger: 3, 2000 ms apart (awake 3000 ms)')
    })

    it('logs the usual op8 for a single picture, whatever the interval', async () => {
        const { logs } = await run({ burst: { photos_per_trigger: 1, photo_interval_milliseconds: 2000 } })

        expect(logs).toContain('Pictures per trigger: 1 (awake 1000 ms)')
    })

    it('says nothing about pictures when the caller has no burst', async () => {
        const { startConfigure, logs } = await run({})

        expect(startConfigure).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ burst: undefined }),
            ['0'],
        )
        expect(logs.some(line => line.startsWith('Pictures per trigger'))).toBe(false)
    })
})
