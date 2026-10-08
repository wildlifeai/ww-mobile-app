import { act, renderHook } from '@testing-library/react-native'

import { useMotionDetectionStream } from '../useMotionDetectionStream'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { mdIntervalHold } from '../../../../ble/session/mdIntervalHold'
import { bleEventBus } from '../../../../ble/protocol/eventBus'
import { DeviceSignal } from '../../../../ble/protocol/deviceSignals'
import { OP_PARAMETER } from '../../../../hooks/useDeviceSettings'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../ble/session/keepAwake', () => ({ keepAwake: { acquire: jest.fn(async () => true), release: jest.fn(async () => {}) } }))
jest.mock('../../../../ble/session/flashHold', () => ({ flashHold: { acquire: jest.fn(async () => true), release: jest.fn(async () => {}), restorePending: jest.fn(async () => {}) } }))
jest.mock('../../../../ble/protocol/bleTransportController', () => ({ bleTransport: { clearAll: jest.fn() } }))
// The owed restore lives on disk, so the store has to keep what it is given
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

const MD_INTERVAL = OP_PARAMETER.MD_INTERVAL

/**
 * The motion grid is the HM0360's own detector, and its rate is programmed
 * from op11 when the device goes to sleep. The test used to leave op11 alone,
 * so after Stop Monitoring or a reset it ran against a detector sampling every
 * two seconds (#274). It now holds op11 at the test interval, lets the device
 * sleep before the capture so the sensor re-arms at that rate, and puts op11
 * back on every way out: raised on a stopped camera, it turns motion capture
 * back on in the field.
 */
describe('useMotionDetectionStream op11 hold', () => {
    /**
     * A camera whose op table moves with every setop that reaches it. It
     * starts as Stop Monitoring leaves one: op11 0, op8 1000, op17 1.
     */
    const makeCamera = (initialOp11 = '0') => {
        const ops = Array.from({ length: 37 }, (_, i) =>
            i === OP_PARAMETER.INTERVAL_BEFORE_DPD ? '1000'
                : i === MD_INTERVAL ? initialOp11
                    : i === OP_PARAMETER.MD_SENSITIVITY ? '1'
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
            waitForSleep: jest.fn(async () => {
                lines.push('(sleep)')
                return true
            }),
        }
        ;(createBleSession as jest.Mock).mockImplementation(() => session)
        return { device, session, lines, op11: () => ops[MD_INTERVAL] }
    }

    const emit = (deviceId: string, line: string) =>
        bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId })

    const dropLink = (camera: ReturnType<typeof makeCamera>) => {
        camera.device.connected = false
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId: camera.device.id, ts: Date.now() })
    }

    /** Let the async setup and cleanup run as far as they can without the timers moving. */
    const settle = async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve()
    }

    /** Start a test and see it acknowledged, as the firmware does. */
    const startAcknowledged = async (camera: ReturnType<typeof makeCamera>, intervalMs = 1000) => {
        const rendered = renderHook(() => useMotionDetectionStream({ device: camera.device }))
        await act(async () => {
            const started = rendered.result.current.startTest(1, intervalMs, 3)
            await settle()
            emit(camera.device.id, `About to capture 3 images with an interval of '${intervalMs}' milliseconds`)
            await started
        })
        return rendered
    }

    beforeEach(() => {
        mdIntervalHold.clear()
    })

    afterEach(() => {
        bleEventBus.removeAllListeners('textLine')
    })

    it('writes the test interval to op11, then lets the device sleep, then captures', async () => {
        const camera = makeCamera('0')

        await startAcknowledged(camera, 1500)

        expect(camera.op11()).toBe('1500')
        const write = camera.lines.indexOf(`AI setop ${MD_INTERVAL} 1500`)
        const sleep = camera.lines.indexOf('(sleep)')
        const capture = camera.lines.indexOf('AI capture 3 1500')
        expect(write).toBeGreaterThanOrEqual(0)
        expect(sleep).toBeGreaterThan(write)
        expect(capture).toBeGreaterThan(sleep)
        // Nothing goes out while the device is being let to sleep.
        expect(capture).toBe(sleep + 1)
    })

    it('puts op11 back after "Captured"', async () => {
        const camera = makeCamera('0')
        await startAcknowledged(camera)

        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('ignores a capture a motion wake reports before the test\'s own capture starts', async () => {
        const camera = makeCamera('0')
        const rendered = renderHook(() => useMotionDetectionStream({ device: camera.device }))

        await act(async () => {
            const started = rendered.result.current.startTest(1, 1000, 3)
            await settle()
            // The detector, held at the test rate through the setup sleep,
            // fires first and reports a capture of its own (bench, 1 October 2026)
            emit(camera.device.id, 'Wake (MD)')
            emit(camera.device.id, 'HM0360 motion in 0 blocks:')
            emit(camera.device.id, Array(32).fill('00').join(' '))
            emit(camera.device.id, 'Captured 1 images. Last is  (File write 0ms avg.)')
            await settle()
            emit(camera.device.id, "About to capture 3 images with an interval of '1000' milliseconds")
            await started
        })

        expect(rendered.result.current.isTesting).toBe(true)
        expect(rendered.result.current.frameCount).toBe(0)
        expect(camera.op11()).toBe('1000')

        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })

        expect(rendered.result.current.isTesting).toBe(false)
        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the operator stops the test', async () => {
        const camera = makeCamera('0')
        const { result } = await startAcknowledged(camera)

        await act(async () => {
            result.current.stopTest()
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the operator leaves the screen mid-test', async () => {
        const camera = makeCamera('0')
        const { unmount } = await startAcknowledged(camera)

        await act(async () => {
            unmount()
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the test is stopped during setup', async () => {
        const camera = makeCamera('0')
        const { result } = renderHook(() => useMotionDetectionStream({ device: camera.device }))

        await act(async () => {
            const started = result.current.startTest(1, 1000, 3)
            result.current.stopTest()
            await settle()
            await started
            await settle()
        })

        expect(camera.lines).toContain(`AI setop ${MD_INTERVAL} 1000`)
        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the capture is never acknowledged', async () => {
        const camera = makeCamera('0')
        const { result } = renderHook(() => useMotionDetectionStream({ device: camera.device }))

        await act(async () => {
            const started = result.current.startTest(1, 1000, 3)
            for (let attempt = 0; attempt < 4; attempt++) {
                await settle()
                jest.advanceTimersByTime(10000)
            }
            await started
            await settle()
        })

        expect(result.current.errorMessage).toMatch(/not acknowledged/)
        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the setup fails after the hold', async () => {
        const camera = makeCamera('0')
        camera.session.waitForSleep.mockRejectedValueOnce(new Error('Session Reset'))
        const { result } = renderHook(() => useMotionDetectionStream({ device: camera.device }))

        await act(async () => {
            await result.current.startTest(1, 1000, 3)
            await settle()
        })

        expect(result.current.errorMessage).toMatch(/failed to start/)
        expect(camera.op11()).toBe('0')
    })

    it('puts op11 back when the camera answers that it is not enabled', async () => {
        const camera = makeCamera('0')
        const { result } = renderHook(() => useMotionDetectionStream({ device: camera.device }))

        await act(async () => {
            result.current.startTest(1, 1000, 3)
            await settle()
            emit(camera.device.id, 'Camera system not enabled')
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('after a dropped link, the next test on the device puts op11 back', async () => {
        const camera = makeCamera('0')
        const first = await startAcknowledged(camera)

        // The link drops mid-test and the operator leaves; nothing can be written.
        await act(async () => {
            dropLink(camera)
            first.unmount()
            await settle()
        })
        expect(camera.op11()).toBe('1000')

        // Reconnected, a new test on the same camera: it keeps the owed 0.
        camera.device.connected = true
        const second = await startAcknowledged(camera, 2000)
        expect(camera.op11()).toBe('2000')
        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })
        second.unmount()

        expect(camera.op11()).toBe('0')
    })

    it('after a dropped link and a reconnect, stopping the stranded test pays the owed restore', async () => {
        const camera = makeCamera('0')
        const { result } = await startAcknowledged(camera)

        await act(async () => {
            dropLink(camera)
            await settle()
        })
        camera.device.connected = true
        await act(async () => {
            result.current.stopTest()
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('after the app was killed mid-test, the owed restore comes back from disk', async () => {
        const camera = makeCamera('0')
        const first = await startAcknowledged(camera)
        await act(async () => {
            dropLink(camera)
            first.unmount()
            await settle()
        })
        mdIntervalHold.clear() // memory gone, storage kept
        expect(camera.op11()).toBe('1000')

        camera.device.connected = true
        await startAcknowledged(camera)
        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })

        expect(camera.op11()).toBe('0')
    })

    it('leaves a deployed camera at its own rate', async () => {
        const camera = makeCamera('1000')
        await startAcknowledged(camera)
        await act(async () => {
            emit(camera.device.id, 'Captured 3 images')
            await settle()
        })

        expect(camera.lines.filter(line => line.startsWith(`AI setop ${MD_INTERVAL} `))).toEqual([])
        expect(camera.op11()).toBe('1000')
    })

    it('captures without waiting when op11 cannot be read', async () => {
        const camera = makeCamera('0')
        camera.session.getOps.mockResolvedValue(Array.from({ length: 9 }, () => '0'))

        await startAcknowledged(camera)

        expect(camera.session.waitForSleep).not.toHaveBeenCalled()
        expect(camera.lines).toContain('AI capture 3 1000')
    })
})
