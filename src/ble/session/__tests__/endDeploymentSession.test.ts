import { createEndDeploymentSession, CAMERA_NOT_ANSWERING } from '../endDeploymentSession'
import { commandRegistry } from '../../protocol/commandRegistry'
import { bleTransport } from '../../protocol/bleTransportController'
import { bleEventBus } from '../../protocol/eventBus'
import { rxRouter } from '../../protocol/rxRouter'
import * as transport from '../../transport'

jest.mock('../../transport', () => ({ writeToDevice: jest.fn() }))
jest.mock('../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const DEVICE_ID = 'end_dev'
const peripheral = { id: DEVICE_ID, name: 'WILD-TEST', connected: true } as any
const mockWrite = transport.writeToDevice as jest.Mock

const reply = (line: string) => rxRouter.handleIncomingBytes(DEVICE_ID, Buffer.from(`${line}\n`))
const writes = (payload: string) => mockWrite.mock.calls.filter((c: any[]) => c[1] === payload).length

/**
 * The device as the tests want it: the nRF always answers `dis`; the Himax
 * answers whatever `himax` returns a line for, and stays silent otherwise.
 */
const device = (himax: (payload: string, attempt: number) => string | null) => {
    mockWrite.mockImplementation(async (_p: unknown, payload: string) => {
        if (payload === 'dis') {
            reply('Disconnecting')
        } else {
            const line = himax(payload, writes(payload))
            if (line) reply(line)
        }
        return true
    })
}

/** Settle a command that runs on fake timers, and let its caller see the result. */
const settle = async <T>(p: Promise<T>, ms = 0) => {
    const result = p.then(v => ({ ok: true as const, v }), (e: Error) => ({ ok: false as const, e }))
    await jest.advanceTimersByTimeAsync(ms)
    return result
}

/**
 * #293. Ending a deployment against a camera asleep in its motion loop waited
 * out every step's timeout and retries in turn, about 40 s under a
 * "Disconnecting" spinner.
 */
describe('createEndDeploymentSession', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockWrite.mockReset()
        bleTransport.clearAll()
        rxRouter.clearBuffer(DEVICE_ID)
    })

    afterEach(() => {
        bleTransport.clearAll()
        rxRouter.clearBuffer(DEVICE_ID)
        jest.useRealTimers()
    })

    it('probes once, then skips the camera and still sends dis', async () => {
        device(() => null)
        const onGiveUp = jest.fn()
        const session = createEndDeploymentSession(peripheral, { onGiveUp })

        const probe = await settle(session.execute(commandRegistry.getops), 8_000)
        expect(probe).toMatchObject({ ok: false, e: expect.objectContaining({ message: 'TIMEOUT' }) })
        expect(writes('AI getop -1')).toBe(1)   // no retry
        expect(onGiveUp).toHaveBeenCalledTimes(1)
        expect(session.cameraNotAnswering()).toBe(true)

        const setdid = await settle(session.execute(() => commandRegistry.setdid(null)))
        expect(setdid).toMatchObject({ ok: false, e: expect.objectContaining({ message: CAMERA_NOT_ANSWERING }) })
        expect(mockWrite.mock.calls.some((c: any[]) => String(c[1]).startsWith('AI setdid'))).toBe(false)

        const dis = await settle(session.execute(commandRegistry.disconnect), 20)
        expect(dis).toEqual({ ok: true, v: true })
        expect(onGiveUp).toHaveBeenCalledTimes(1)
    })

    it('a camera that answers is not cut short, and later steps keep their own retries', async () => {
        // setdid is lost once and answered on its retry, 8 s later.
        device((payload, attempt) => {
            if (payload === 'AI getop -1') return 'OpParams 1 2 3'
            if (payload.startsWith('AI setdid')) return attempt >= 2 ? 'Deployment ID set to 00000000' : null
            return null
        })
        const onGiveUp = jest.fn()
        const session = createEndDeploymentSession(peripheral, { onGiveUp })

        expect(await settle(session.execute(commandRegistry.getops), 20)).toEqual({ ok: true, v: ['1', '2', '3'] })
        expect(await settle(session.execute(() => commandRegistry.setdid(null)), 8_020)).toEqual({ ok: true, v: true })
        expect(onGiveUp).not.toHaveBeenCalled()
        expect(session.cameraNotAnswering()).toBe(false)
    })

    it('the budget cancels a step still waiting when it runs out, with nothing left behind', async () => {
        device(payload => (payload === 'AI getop -1' ? 'OpParams 1 2 3' : null))
        const onGiveUp = jest.fn()
        const session = createEndDeploymentSession(peripheral, { budgetMs: 5_000, onGiveUp })

        await settle(session.execute(commandRegistry.getops), 20)
        const setop = await settle(session.execute(() => commandRegistry.setop({ index: 11, value: '0' })), 5_000)
        expect(setop).toMatchObject({ ok: false, e: expect.objectContaining({ message: 'Command cancelled' }) })
        expect(onGiveUp).toHaveBeenCalledTimes(1)

        // The cancelled setop took its listeners and timeout with it (#257): no
        // retry lands on the device afterwards.
        expect(bleEventBus.listenerCount('textLine')).toBe(0)
        await jest.advanceTimersByTimeAsync(30_000)
        expect(writes('AI setop 11 0')).toBe(1)
    })
})
