import { renderHook, act } from '@testing-library/react-native'

import { useEngineerConsoleActions, FORMAT_CONFIRM_TIMEOUT_MS } from '../useEngineerConsoleActions'
import { useBle } from '../../../../hooks/useBle'
import { CommandNames } from '../../../../ble/types'
import { bleEventBus } from '../../../../ble/protocol/eventBus'

jest.mock('../../../../hooks/useBle')
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

const mount = () => {
    const writeRaw = jest.fn(async () => {})
    ;(useBle as jest.Mock).mockReturnValue({ writeRaw, disconnectDevice: jest.fn(), connectDevice: jest.fn() })
    const dispatch = jest.fn()
    const { result } = renderHook(() => useEngineerConsoleActions({
        device,
        consoleState: { inputText: '' },
        dispatch,
        navigation: { navigate: jest.fn() },
    }))
    return { result, writeRaw, dispatch }
}

// #300: a command that takes values is never sent without them.
describe('useEngineerConsoleActions.onRunHelpCommand', () => {
    beforeEach(() => jest.clearAllMocks())

    it('does not send setop without its index and value', async () => {
        const { result, writeRaw, dispatch } = mount()

        await act(async () => { await result.current.onRunHelpCommand(CommandNames.setop, ['11']) })

        expect(writeRaw).not.toHaveBeenCalled()
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'APPEND_HISTORY',
            payload: expect.objectContaining({ type: 'error' }),
        }))
    })

    it('sends the values it was given', async () => {
        const { result, writeRaw } = mount()

        await act(async () => { await result.current.onRunHelpCommand(CommandNames.getop, ['17']) })
        await act(async () => { await result.current.onRunHelpCommand(CommandNames.setop, ['11', '1000']) })

        expect(writeRaw).toHaveBeenNthCalledWith(1, device, 'AI getop 17')
        expect(writeRaw).toHaveBeenNthCalledWith(2, device, 'AI setop 11 1000')
    })

    it('still sends a command that takes no values at once', async () => {
        const { result, writeRaw } = mount()

        await act(async () => { await result.current.onRunHelpCommand(CommandNames.getop_all) })

        expect(writeRaw).toHaveBeenCalledWith(device, 'AI getop -1')
    })

    it('takes one photo with one capture and nothing else', async () => {
        const { result, writeRaw } = mount()

        await act(async () => { await result.current.onRunHelpCommand(CommandNames.capture_one) })

        expect(writeRaw).toHaveBeenCalledTimes(1)
        expect(writeRaw).toHaveBeenCalledWith(device, 'AI capture 1 500')
    })
})

// The firmware formats only on a second `format` before the Himax sleeps, about
// a second after the first; two taps on Run could not land in that window.
describe('useEngineerConsoleActions format', () => {
    const ASK = "WARNING: all data on the SD card will be erased.\r\nRun 'format' again to confirm. This will take several seconds."

    beforeEach(() => jest.clearAllMocks())
    afterEach(() => bleEventBus.removeAllListeners('textLine'))

    it('sends the second format itself once the camera asks for it', async () => {
        const { result, writeRaw } = mount()
        writeRaw.mockImplementationOnce(async () => {
            bleEventBus.emitEvent({ type: 'TEXT_LINE', line: ASK, ts: Date.now(), deviceId: device.id })
        })

        await act(async () => { await result.current.onRunHelpCommand(CommandNames.format) })

        expect(writeRaw).toHaveBeenCalledTimes(2)
        expect(writeRaw).toHaveBeenNthCalledWith(1, device, 'AI format')
        expect(writeRaw).toHaveBeenNthCalledWith(2, device, 'AI format')
    })

    it('does not send the second format when the camera never asks', async () => {
        jest.useFakeTimers()
        const { result, writeRaw, dispatch } = mount()

        await act(async () => {
            const run = result.current.onRunHelpCommand(CommandNames.format)
            await Promise.resolve()
            jest.advanceTimersByTime(FORMAT_CONFIRM_TIMEOUT_MS)
            await run
        })

        expect(writeRaw).toHaveBeenCalledTimes(1)
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'APPEND_HISTORY',
            payload: expect.objectContaining({ type: 'error', content: expect.stringMatching(/not confirmed/) }),
        }))
    })
})
