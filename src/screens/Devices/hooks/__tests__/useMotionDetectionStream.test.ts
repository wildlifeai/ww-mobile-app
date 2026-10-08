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

/** What `md` meets on the HM0360 build today: the nRF drops the reply. */
const lostReply = async () => { throw new Error('TIMEOUT') }

/**
 * Stub the BLE session. `md` behaves as the test says, and so does the op17
 * write when `setop17` is given; the capture is acknowledged at once, as the
 * firmware's CLI does, and every other command resolves. Returns every command
 * string sent, in order.
 */
const mockSession = (op17: string, md: () => Promise<unknown>, setop17?: () => Promise<unknown>) => {
    const sent: string[] = []
    const execute = jest.fn(async (build: () => any) => {
        const cmd = build()
        const line: string = cmd.build()
        sent.push(line)
        switch (cmd.name) {
            case 'getops': return ops(op17)
            case 'md': return md()
            case 'setop':
                if (setop17 && line.startsWith('AI setop 17 ')) return setop17()
                return true
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

// #272: the test skips the write when op17 already holds the level, and says
// so when the camera refuses it. #385: Med and High always showed "may not
// have taken" on the HM0360 build, whose `md` reply the nRF drops, so the
// level is written with an acknowledged setop and `md` only asks whether the
// build applies it.
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

    it('sends nothing for the sensitivity when op17 already holds the level', async () => {
        const sent = mockSession('2', async () => true)
        const result = await runTest(2)

        expect(sent.some(c => c.startsWith('AI md') || c.startsWith('AI setop 17 '))).toBe(false)
        expect(sent).toContain('AI capture 5 1000')
        expect(result.current.sensitivityNote).toBeNull()
    })

    it('writes op17 with setop, then asks md, when op17 differs', async () => {
        const sent = mockSession('1', async () => true)
        const result = await runTest(3)

        expect(sent.indexOf('AI setop 17 3')).toBeGreaterThanOrEqual(0)
        expect(sent.indexOf('AI md 3')).toBeGreaterThan(sent.indexOf('AI setop 17 3'))
        expect(result.current.sensitivityNote).toBeNull()
    })

    // The HM0360 build's case today: the Himax answers `md`, the nRF drops the
    // reply (ww-hardware #52), and the app hears nothing. The setop was
    // acknowledged, so the level holds and there is nothing to say (#385).
    it.each([2, 3])('says nothing when md goes unanswered but op17 was confirmed, level %i', async (level) => {
        mockSession('1', lostReply)
        const result = await runTest(level)

        expect(result.current.sensitivityNote).toBeNull()
    })

    it('shows a refusal from a build without md, puts op17 back, and still runs the test', async () => {
        const sent = mockSession('1', async () => { throw mdFailure('Unrecognised') })
        const result = await runTest(3)

        expect(result.current.sensitivityNote?.kind).toBe('refused')
        expect(result.current.sensitivityNote?.message).toMatch(/colour camera/)
        expect(sent.indexOf('AI setop 17 1')).toBeGreaterThan(sent.indexOf('AI md 3'))
        expect(sent).toContain('AI capture 5 1000')
    })

    it('shows unconfirmed only when the op17 write itself was not acknowledged', async () => {
        mockSession('1', lostReply, async () => { throw new Error('TIMEOUT') })
        const result = await runTest(2)

        expect(result.current.sensitivityNote?.kind).toBe('unconfirmed')
    })

    it('writes op17 and asks md when the op table could not be read', async () => {
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

        expect(sent).toContain('AI setop 17 2')
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
