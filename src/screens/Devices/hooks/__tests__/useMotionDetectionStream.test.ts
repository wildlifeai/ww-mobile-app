import { renderHook, act } from '@testing-library/react-native'

import { useMotionDetectionStream } from '../useMotionDetectionStream'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { keepAwake } from '../../../../ble/session/keepAwake'
import { mdIntervalHold } from '../../../../ble/session/mdIntervalHold'
import { bleEventBus } from '../../../../ble/protocol/eventBus'
import { commandRegistry, isMdRefusal } from '../../../../ble/protocol/commandRegistry'

jest.mock('../../../../ble/session/createBleSession')
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/** A device's op table: op8 at 1000 ms, op17 as the test says, everything else 0. */
const ops = (op17: string): string[] =>
    Array.from({ length: 37 }, (_, i) => (i === 8 ? '1000' : i === 17 ? op17 : '0'))

const emit = (line: string) =>
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId: device.id })

/** The error the registry raises when `md` meets one of its failure lines. */
const mdFailure = (line: string): Error => {
    const cmd = commandRegistry.md(2)
    cmd.collect(line)
    try {
        cmd.parser()
    } catch (e) {
        return e as Error
    }
    throw new Error(`md accepted "${line}"`)
}

/**
 * Stub the BLE session. `md` behaves as the test says; the capture is
 * acknowledged at once, as the firmware's CLI does, and every other command
 * resolves. Returns every command string sent, in order.
 */
const mockSession = (op17: string, md: () => Promise<unknown>) => {
    const sent: string[] = []
    const execute = jest.fn(async (build: () => any) => {
        const cmd = build()
        sent.push(cmd.build())
        switch (cmd.name) {
            case 'getops': return ops(op17)
            case 'md': return md()
            case 'capture':
                emit("About to capture 5 images with an interval of '1000' milliseconds")
                return new Promise(() => {})
            default: return true
        }
    })
    ;(createBleSession as jest.Mock).mockReturnValue({
        execute,
        getOps: jest.fn(async () => ops(op17)),
        waitForSleep: jest.fn(async () => true),
    })
    return sent
}

const runTest = async (level: number) => {
    const rendered = renderHook(() => useMotionDetectionStream({ device }))
    await act(async () => { await rendered.result.current.startTest(level, 1000, 5) })
    return rendered.result
}

// #272: the test skips `md` when op17 already holds the level, and says so
// when the camera refuses the command or never answers it.
describe('useMotionDetectionStream sensitivity', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        keepAwake.clear()
        mdIntervalHold.clear()
        bleEventBus.removeAllListeners()
        // The capture's 10 s acknowledgement wait must not outlive the test.
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('does not send md when op17 already holds the level', async () => {
        const sent = mockSession('2', async () => true)
        const result = await runTest(2)

        expect(sent.some(c => c.startsWith('AI md'))).toBe(false)
        expect(sent).toContain('AI capture 5 1000')
        expect(result.current.sensitivityNote).toBeNull()
    })

    it('sends md when op17 differs, and says nothing once the camera confirms it', async () => {
        const sent = mockSession('1', async () => true)
        const result = await runTest(3)

        expect(sent).toContain('AI md 3')
        expect(result.current.sensitivityNote).toBeNull()
    })

    it('shows a refusal from a build without md, and still runs the test', async () => {
        const sent = mockSession('1', async () => { throw mdFailure('Unrecognised') })
        const result = await runTest(3)

        expect(result.current.sensitivityNote?.kind).toBe('refused')
        expect(sent).toContain('AI capture 5 1000')
    })

    // The HM0360 build's case today: the Himax answers, the nRF drops it
    // (ww-hardware #52), and the app hears nothing. That is not a refusal.
    it('shows a lost reply as unconfirmed, not as a refusal', async () => {
        mockSession('1', async () => { throw new Error('TIMEOUT') })
        const result = await runTest(2)

        expect(result.current.sensitivityNote?.kind).toBe('unconfirmed')
    })

    it('sends md when the op table could not be read', async () => {
        const sent: string[] = []
        const execute = jest.fn(async (build: () => any) => {
            const cmd = build()
            sent.push(cmd.build())
            if (cmd.name === 'getops') throw new Error('TIMEOUT')
            if (cmd.name === 'capture') {
                emit("About to capture 5 images with an interval of '1000' milliseconds")
                return new Promise(() => {})
            }
            return true
        })
        ;(createBleSession as jest.Mock).mockReturnValue({ execute, getOps: jest.fn() })

        await runTest(2)

        expect(sent).toContain('AI md 2')
    })
})

describe('isMdRefusal', () => {
    it.each([
        ['Unrecognised', true],
        ['Error: Sensitivity must be an integer between 0 and 3.', true],
        ['Sleep', false],
    ])('reads md failing on "%s" as a refusal: %s', (line, refused) => {
        expect(isMdRefusal(mdFailure(line))).toBe(refused)
    })

    it('does not read a timeout or a reset queue as a refusal', () => {
        expect(isMdRefusal(new Error('TIMEOUT'))).toBe(false)
        expect(isMdRefusal(new Error('Session Reset'))).toBe(false)
    })
})
