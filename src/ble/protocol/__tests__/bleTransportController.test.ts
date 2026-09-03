import { bleTransport } from '../bleTransportController'
import { bleEventBus } from '../eventBus'
import { DeviceSignal } from '../deviceSignals'
import { BLE_PROTOCOL_TIMINGS } from '../protocolConstants'
import { imageReassemblerEmitter } from '../../emitters'

const DEVICE = 'dev_a'
const signal = (s: typeof DeviceSignal.SLEEP | typeof DeviceSignal.WAKE | typeof DeviceSignal.DISCONNECT) =>
    bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: s, deviceId: DEVICE, ts: Date.now() })

/** A task whose completion the test controls. */
const controllable = () => {
    let finish!: (v: string) => void
    const started = jest.fn()
    const execute = () => new Promise<string>(resolve => { started(); finish = resolve })
    return { execute, started, finish: (v = 'ok') => finish(v) }
}

const drain = () => jest.advanceTimersByTimeAsync(BLE_PROTOCOL_TIMINGS.POST_COMPLETION_DRAIN_WINDOW_MS + 1)

/**
 * Keep a failed assertion readable: clearAll() in afterEach rejects any task
 * a failing test left in flight, and an unobserved rejection takes the whole
 * suite down with "Session Reset" instead of the assertion message.
 */
const enqueue = (execute: () => Promise<string>) => {
    const p = bleTransport.enqueue(execute)
    p.catch(() => {})
    return p
}

beforeEach(() => {
    jest.useFakeTimers()
    bleTransport.clearAll()
})

afterEach(() => {
    bleTransport.clearAll()
    jest.useRealTimers()
})

/**
 * The queue pauses on the device's Sleep signal. The device is woken only by
 * a command, so that pause must lift on its own or everything queued behind
 * it hangs. Found on the bench on 3 September 2026: a Sleep that landed while
 * a slow JS thread was still completing `slots` froze the Capture Picture
 * screen until the link dropped.
 */
describe('bleTransportController sleep pause', () => {
    it('a Sleep during a command does not strand the commands behind it', async () => {
        const a = controllable()
        const b = controllable()
        const pa = enqueue(a.execute)
        const pb = enqueue(b.execute)
        await Promise.resolve()
        expect(a.started).toHaveBeenCalled()

        // The device announces Sleep while A is still in flight.
        signal(DeviceSignal.SLEEP)
        expect(bleTransport.transportState).toBe('PAUSED_SLEEP')

        a.finish()
        await drain()
        await expect(pa).resolves.toBe('ok')
        // Paused: B waits...
        expect(b.started).not.toHaveBeenCalled()

        // ...but not forever. No Wake ever comes; the settle lifts the pause.
        await jest.advanceTimersByTimeAsync(BLE_PROTOCOL_TIMINGS.SLEEP_SETTLE_MS + 1)
        expect(b.started).toHaveBeenCalledTimes(1)
        b.finish('b')
        await drain()
        await expect(pb).resolves.toBe('b')
    })

    it('a Wake lifts the pause at once, and the settle does not dispatch twice', async () => {
        const a = controllable()
        const b = controllable()
        enqueue(a.execute)
        const pb = enqueue(b.execute)
        await Promise.resolve()

        signal(DeviceSignal.SLEEP)
        a.finish()
        await drain()
        expect(b.started).not.toHaveBeenCalled()

        signal(DeviceSignal.WAKE)
        await Promise.resolve()
        expect(b.started).toHaveBeenCalledTimes(1)

        await jest.advanceTimersByTimeAsync(BLE_PROTOCOL_TIMINGS.SLEEP_SETTLE_MS + 1)
        expect(b.started).toHaveBeenCalledTimes(1)
        b.finish()
        await drain()
        await expect(pb).resolves.toBe('ok')
    })

    it('a Sleep while nothing is running is ignored, so the next command goes straight out', async () => {
        signal(DeviceSignal.SLEEP)
        expect(bleTransport.transportState).toBe('IDLE')

        const a = controllable()
        const pa = enqueue(a.execute)
        await Promise.resolve()
        expect(a.started).toHaveBeenCalledTimes(1)
        a.finish()
        await drain()
        await expect(pa).resolves.toBe('ok')
    })

    it('a pause with nothing queued behind it is dropped, so the next command goes straight out', async () => {
        // The queue goes IDLE when it empties, pause or no pause: the next
        // command is the wake, exactly as for any first command after a sleep.
        const a = controllable()
        const pa = enqueue(a.execute)
        await Promise.resolve()
        signal(DeviceSignal.SLEEP)
        a.finish()
        await drain()
        await pa
        expect(bleTransport.transportState).toBe('IDLE')

        const b = controllable()
        const pb = enqueue(b.execute)
        await Promise.resolve()
        expect(b.started).toHaveBeenCalledTimes(1)
        b.finish()
        await drain()
        await expect(pb).resolves.toBe('ok')
    })
})

/**
 * While an image streams in, nothing may be sent: the nRF forwards any
 * command to the Himax at once, restarts its binary packet counter, and the
 * reply comes only once the file has finished. Found on the bench on
 * 3 September 2026: a re-entered screen's `slots` landed mid-stream, drew
 * "AI processor not responding", 412 phantom sequence gaps and a reply 14 s
 * late. The reassembler announces the stream; the queue holds for it.
 */
describe('bleTransportController image stream gate', () => {
    const streamStart = () => imageReassemblerEmitter.emit('onImageStart', 26439)

    it('holds a command queued during a stream until the image is saved', async () => {
        streamStart()
        expect(bleTransport.isStreaming).toBe(true)
        const a = controllable()
        const pa = enqueue(a.execute)
        await Promise.resolve()
        expect(a.started).not.toHaveBeenCalled()

        imageReassemblerEmitter.emit('onImageComplete', 'file://x.jpg')
        await Promise.resolve()
        expect(bleTransport.isStreaming).toBe(false)
        expect(a.started).toHaveBeenCalledTimes(1)
        a.finish()
        await drain()
        await expect(pa).resolves.toBe('ok')
    })

    it('a stream that starts while a command is in flight lets it finish, then holds the next', async () => {
        // txfile itself resolves on the "N bytes in" line that starts the stream.
        const a = controllable()
        const b = controllable()
        const pa = enqueue(a.execute)
        const pb = enqueue(b.execute)
        await Promise.resolve()
        expect(a.started).toHaveBeenCalled()

        streamStart()
        a.finish()
        await drain()
        await expect(pa).resolves.toBe('ok')
        expect(b.started).not.toHaveBeenCalled()

        // A failed transfer releases the queue just as a saved one does.
        imageReassemblerEmitter.emit('onImageError', 'Image transfer incomplete')
        await Promise.resolve()
        expect(b.started).toHaveBeenCalledTimes(1)
        b.finish('b')
        await drain()
        await expect(pb).resolves.toBe('b')
    })

    it('a stream that goes quiet releases the queue after IMAGE_STREAM_STALL_MS, and packets keep it held', async () => {
        streamStart()
        const a = controllable()
        const pa = enqueue(a.execute)
        await jest.advanceTimersByTimeAsync(BLE_PROTOCOL_TIMINGS.IMAGE_STREAM_STALL_MS - 1)
        expect(a.started).not.toHaveBeenCalled()

        // A packet arrives: the silence starts again from here.
        imageReassemblerEmitter.emit('onImageProgress', 0.5)
        await jest.advanceTimersByTimeAsync(BLE_PROTOCOL_TIMINGS.IMAGE_STREAM_STALL_MS - 1)
        expect(a.started).not.toHaveBeenCalled()

        await jest.advanceTimersByTimeAsync(2)
        expect(bleTransport.isStreaming).toBe(false)
        expect(a.started).toHaveBeenCalledTimes(1)
        a.finish()
        await drain()
        await expect(pa).resolves.toBe('ok')
    })

    it('a disconnect drops the gate with everything else', () => {
        streamStart()
        expect(bleTransport.isStreaming).toBe(true)
        signal(DeviceSignal.DISCONNECT)
        expect(bleTransport.isStreaming).toBe(false)
    })
})
