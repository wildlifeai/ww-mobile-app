import { measureLight } from '../deploymentPipeline'
import { bleEventBus } from '../../protocol/eventBus'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))

/**
 * `AI light` is two-phase: the command replies `Checking light level...` as an
 * acknowledgement and the reading arrives afterwards as telemetry. A blocking
 * variant deadlocked over BLE, so the firmware will not be given one, which
 * makes this wait the only way the deployment can read the light without taking
 * a photograph.
 *
 * These tests pin the three things that matter: the reading comes from the
 * telemetry rather than the reply, the listener is subscribed before the send,
 * and firmware without the command fails fast instead of sitting out 15 s.
 */
describe('measureLight', () => {
    const DEVICE = 'AA:BB:CC:DD:EE:FF'

    const emitRegisterBlock = (deviceId: string = DEVICE) => {
        const lines = [
            'HM0360 AE regs:',
            '  Integration time = 91 lines',
            '  Analog gain = 0',
            '  Digital gain = 64',
            '  AE Mean = 81',
            '  AEConverged?: Y',
        ]
        lines.forEach(line => bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId }))
    }

    afterEach(() => {
        bleEventBus.removeAllListeners('textLine')
    })

    it('resolves from the telemetry, not from the command reply', async () => {
        // The acknowledgement never resolves. Only the register block does.
        const session = { execute: jest.fn(() => new Promise(() => {})) }

        const pending = measureLight(session as any, DEVICE)
        await Promise.resolve()
        emitRegisterBlock()

        await expect(pending).resolves.toBe('ok')
    })

    it('subscribes before sending, so a block that arrives instantly is not missed', async () => {
        // A device that answers within the same tick as the send.
        const session = {
            execute: jest.fn(async () => {
                emitRegisterBlock()
                return true
            }),
        }

        await expect(measureLight(session as any, DEVICE)).resolves.toBe('ok')
    })

    /**
     * The caller distinguishes this from 'ok' to decide whether the deployment log
     * may call op25 a measurement. A version that treated anything other than
     * 'failed' as a reading would label a timed-out check "Light check", which is
     * the stale-value-as-measurement bug the light step was rewritten to stop.
     */
    it('reports timeout when the command is acknowledged but no reading follows', async () => {
        jest.useFakeTimers()
        try {
            const session = { execute: jest.fn(async () => true) }   // acked, then silence
            const pending = measureLight(session as any, DEVICE)
            await Promise.resolve()
            await Promise.resolve()
            jest.advanceTimersByTime(15_000)
            await expect(pending).resolves.toBe('timeout')
        } finally {
            jest.useRealTimers()
        }
    })

    it('reports unsupported when the firmware does not know the command', async () => {
        const session = { execute: jest.fn(async () => { throw new Error('Unrecognised command') }) }

        // No block is ever emitted; this must not wait out the 15 s ceiling.
        await expect(measureLight(session as any, DEVICE)).resolves.toBe('unsupported')
    })

    it('ignores a block from a different device', async () => {
        const session = { execute: jest.fn(() => new Promise(() => {})) }

        const pending = measureLight(session as any, DEVICE)
        await Promise.resolve()
        emitRegisterBlock('11:22:33:44:55:66')

        const settled = await Promise.race([pending, Promise.resolve('still waiting')])
        expect(settled).toBe('still waiting')
    })

    it('leaves no listener on the shared bus once it has settled', async () => {
        const session = { execute: jest.fn(async () => { throw new Error('Unrecognised command') }) }

        await measureLight(session as any, DEVICE)

        expect(bleEventBus.listenerCount('textLine')).toBe(0)
    })
})
