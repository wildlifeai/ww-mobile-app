import { configureDevice } from '../deploymentPipeline'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

/**
 * What Start Monitoring and the Dev Deployment Test hand the configuration
 * step for the project's detection threshold, and what the deployment log says
 * about it, the op16 written included (#342). The op write itself is pinned in
 * useDeploymentConfiguration.test.ts.
 */
describe('configureDevice detection threshold', () => {
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

    it('passes the project threshold through and logs it with its op16', async () => {
        const detectionThreshold = { detection_threshold_pct: 80 }

        const { startConfigure, logs } = await run({ detectionThreshold })

        expect(startConfigure).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ detectionThreshold }),
            ['0'],
        )
        expect(logs).toContain('Detection threshold: 80% (op16 77)')
    })

    it('logs the default for a project without one', async () => {
        const { logs } = await run({ detectionThreshold: { detection_threshold_pct: null } })

        expect(logs).toContain('Detection threshold: 57% (op16 18)')
    })

    it('says nothing about the threshold when the caller has none', async () => {
        const { startConfigure, logs } = await run({})

        expect(startConfigure).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ detectionThreshold: undefined }),
            ['0'],
        )
        expect(logs.some(line => line.startsWith('Detection threshold'))).toBe(false)
    })
})
