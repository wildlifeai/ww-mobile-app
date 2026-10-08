import { act, renderHook } from '@testing-library/react-native'

import { useMotionDetectionStream } from '../useMotionDetectionStream'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { flashHold } from '../../../../ble/session/flashHold'
import { flashLedHold } from '../../../../ble/session/flashLedHold'
import { keepAwake } from '../../../../ble/session/keepAwake'
import { mdIntervalHold } from '../../../../ble/session/mdIntervalHold'
import { bleEventBus } from '../../../../ble/protocol/eventBus'
import { DeviceSignal } from '../../../../ble/protocol/deviceSignals'
import { OP_PARAMETER } from '../../../../hooks/useDeviceSettings'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../ble/protocol/bleTransportController', () => ({ bleTransport: { clearAll: jest.fn() } }))
// The owed restores live on disk, so the store has to keep what it is given
// across steps; `restoreMocks: true` empties the global mock between them.
jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>()
    return {
        __esModule: true,
        default: {
            setItem: async (key: string, value: string) => { store.set(key, value) },
            getItem: async (key: string) => store.get(key) ?? null,
            removeItem: async (key: string) => { store.delete(key) },
            clear: async () => { store.clear() },
        },
    }
})

const { FLASH_LED, LED_BRIGHTNESS, FLASH_MODE, MD_INTERVAL, INTERVAL_BEFORE_DPD } = OP_PARAMETER

/**
 * A motion test with the flash on writes the LED and brightness (op13, op9)
 * and the always-on flash mode (op34), and the camera's own photos use all
 * three. op13 used to be written with a plain setop and never put back (#387),
 * and with op34 at always-on for the wake the test ended in, the firmware armed
 * the STROBE for the sleep after it and lit op21's LED on every motion frame
 * (#383). A test that dropped its link left all of them behind. Every test here
 * runs the real holds against a camera whose op table moves with each setop.
 */
describe('useMotionDetectionStream flash', () => {
    /** A camera as a bench unit leaves the factory: no flash, 5 %, op8 1000, op11 0, op17 1. */
    const makeCamera = () => {
        const ops: string[] = Array.from({ length: 37 }, (_, i) =>
            i === INTERVAL_BEFORE_DPD ? '1000'
                : i === LED_BRIGHTNESS ? '5'
                    : i === OP_PARAMETER.MD_SENSITIVITY ? '1'
                        : i === OP_PARAMETER.MD_FLASH_LED ? '2'
                            : i === OP_PARAMETER.MD_FLASH_BRIGHTNESS_PERCENT ? '50'
                                : '0')
        const device = { id: 'AA:BB', connected: true } as any
        const lines: string[] = []
        const session = {
            execute: jest.fn(async (build: any) => {
                if (!device.connected) throw new Error('DEVICE_DISCONNECTED')
                const line: string = build().build()
                lines.push(line)
                const setop = /^AI setop (\d+) (\d+)$/.exec(line)
                if (setop) ops[Number(setop[1])] = setop[2]
                if (/getop -1/.test(line)) return ops.slice()
                return true
            }),
            getOps: jest.fn(async () => {
                if (!device.connected) throw new Error('DEVICE_DISCONNECTED')
                return ops.slice()
            }),
            waitForSleep: jest.fn(async () => true),
        }
        ;(createBleSession as jest.Mock).mockImplementation(() => session)
        const op = (index: number) => ops[index]
        return { device, session, lines, ops, op }
    }

    const emit = (deviceId: string, line: string) =>
        bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId })

    const dropLink = (camera: ReturnType<typeof makeCamera>) => {
        camera.device.connected = false
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId: camera.device.id, ts: Date.now() })
    }

    /** Let the async setup and cleanup run as far as they can without the timers moving. */
    const settle = async () => {
        for (let i = 0; i < 300; i++) await Promise.resolve()
    }

    /** Start a test, IR at 50 % unless told otherwise, and see it acknowledged. */
    const startAcknowledged = async (camera: ReturnType<typeof makeCamera>, flashLed = 2, brightness = 50) => {
        const rendered = renderHook(() => useMotionDetectionStream({ device: camera.device }))
        await act(async () => {
            const started = rendered.result.current.startTest(1, 1000, 3, flashLed, brightness)
            await settle()
            emit(camera.device.id, "About to capture 3 images with an interval of '1000' milliseconds")
            await started
        })
        return rendered
    }

    const finish = async (camera: ReturnType<typeof makeCamera>) => {
        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })
    }

    /** The flash as the camera's own photos and its sleep would use it. */
    const flash = (camera: ReturnType<typeof makeCamera>) =>
        ({ led: camera.op(FLASH_LED), brightness: camera.op(LED_BRIGHTNESS), mode: camera.op(FLASH_MODE) })

    const FACTORY_FLASH = { led: '0', brightness: '5', mode: '0' }

    beforeEach(() => {
        flashHold.clear()
        flashLedHold.clear()
        keepAwake.clear()
        mdIntervalHold.clear()
    })

    afterEach(() => {
        bleEventBus.removeAllListeners('textLine')
    })

    it('lights the test with the chosen LED and brightness, armed always on', async () => {
        const camera = makeCamera()

        await startAcknowledged(camera)

        expect(flash(camera)).toEqual({ led: '2', brightness: '50', mode: '2' })
        // All of it on the card before the sleep the capture's wake follows.
        const capture = camera.lines.indexOf('AI capture 3 1000')
        expect(camera.lines.indexOf(`AI setop ${FLASH_LED} 2`)).toBeLessThan(capture)
        expect(camera.lines.indexOf(`AI setop ${LED_BRIGHTNESS} 50`)).toBeLessThan(capture)
    })

    it('puts the LED, brightness and mode back after "Captured" (#387)', async () => {
        const camera = makeCamera()
        await startAcknowledged(camera)

        await finish(camera)

        expect(flash(camera)).toEqual(FACTORY_FLASH)
        expect(camera.op(MD_INTERVAL)).toBe('0')
        expect(camera.op(INTERVAL_BEFORE_DPD)).toBe('1000')
    })

    it('puts op13 back before op8, the order a part-way drop is kindest in', async () => {
        const camera = makeCamera()
        await startAcknowledged(camera)

        await finish(camera)

        const restoreLed = camera.lines.lastIndexOf(`AI setop ${FLASH_LED} 0`)
        const restoreOp8 = camera.lines.lastIndexOf(`AI setop ${INTERVAL_BEFORE_DPD} 1000`)
        expect(restoreLed).toBeGreaterThan(camera.lines.indexOf('AI capture 3 1000'))
        expect(restoreLed).toBeLessThan(restoreOp8)
    })

    it.each([
        ['the operator stops the test', async (rendered: any) => rendered.result.current.stopTest()],
        ['the operator leaves the screen', async (rendered: any) => rendered.unmount()],
    ])('puts the flash back when %s', async (_why, leave) => {
        const camera = makeCamera()
        const rendered = await startAcknowledged(camera)

        await act(async () => {
            await leave(rendered)
            await settle()
        })

        expect(flash(camera)).toEqual(FACTORY_FLASH)
    })

    it('leaves the flash settings alone when the test asks for no flash', async () => {
        const camera = makeCamera()
        await startAcknowledged(camera, 0)
        await finish(camera)

        const flashWrites = camera.lines.filter(line =>
            [FLASH_LED, LED_BRIGHTNESS, FLASH_MODE].some(index => line.startsWith(`AI setop ${index} `)))
        expect(flashWrites).toEqual([])
    })

    // #383: the app died mid-test, so nothing put the flash back, and the
    // camera kept lighting its frames with the link gone. The next test pays
    // what is owed, flash or no flash.
    it('after the app was killed mid-test, the next test puts the flash back even without a flash of its own', async () => {
        const camera = makeCamera()
        const first = await startAcknowledged(camera)
        await act(async () => {
            dropLink(camera)
            first.unmount()
            await settle()
        })
        flashHold.clear()
        flashLedHold.clear()
        keepAwake.clear()
        mdIntervalHold.clear() // memory gone, storage kept
        expect(flash(camera)).toEqual({ led: '2', brightness: '50', mode: '2' })
        expect(camera.op(MD_INTERVAL)).toBe('1000')

        camera.device.connected = true
        await startAcknowledged(camera, 0)
        await finish(camera)

        expect(flash(camera)).toEqual(FACTORY_FLASH)
        expect(camera.op(MD_INTERVAL)).toBe('0')
    })

    it('after a dropped link, the next test with the flash still goes back to the settings from before both', async () => {
        const camera = makeCamera()
        const first = await startAcknowledged(camera)
        await act(async () => {
            dropLink(camera)
            first.unmount()
            await settle()
        })

        camera.device.connected = true
        await startAcknowledged(camera, 1, 100)
        expect(flash(camera)).toEqual({ led: '1', brightness: '100', mode: '2' })
        await finish(camera)

        expect(flash(camera)).toEqual(FACTORY_FLASH)
    })

    it('leaves a deployment\'s flash alone, whatever a dropped test left owed', async () => {
        const camera = makeCamera()
        const first = await startAcknowledged(camera)
        await act(async () => {
            dropLink(camera)
            first.unmount()
            await settle()
        })

        // Start Monitoring for an IR project with the light-sensor mode: the
        // deployment drops what is owed, then writes the project's flash.
        await flashHold.forget(camera.device.id)
        await flashLedHold.forget(camera.device.id)
        camera.ops[FLASH_LED] = '2'
        camera.ops[FLASH_MODE] = '1'
        camera.ops[LED_BRIGHTNESS] = '5'

        camera.device.connected = true
        await startAcknowledged(camera, 0)
        await finish(camera)

        expect(flash(camera)).toEqual({ led: '2', brightness: '5', mode: '1' })
    })
})
