import { runFileTransferPipeline } from '../runFileTransferPipeline'
import { MAX_PAYLOAD_BYTES } from '../fileTransferTypes'
import { writeBinaryToDevice } from '../../../transport'
import { bleTransport } from '../../bleTransportController'
import { bleEventBus } from '../../eventBus'
import { DeviceSignal } from '../../deviceSignals'
import { activateKeepAwakeAsync } from 'expo-keep-awake'
import BleManager from 'react-native-ble-manager'
import { NativeEventEmitter } from 'react-native'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('react-native-ble-manager', () => ({ __esModule: true, default: { requestConnectionPriority: jest.fn() } }))
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }))
jest.mock('../../../transport', () => ({ writeBinaryToDevice: jest.fn() }))
jest.mock('../../runCommandPipeline', () => ({ runCommandPipeline: jest.fn() }))
jest.mock('../../bleTransportController', () => ({
    bleTransport: { isBusy: jest.fn(), acquireLock: jest.fn(), releaseLock: jest.fn(), enqueue: jest.fn() },
}))

const PERIPHERAL = { id: 'AA:BB:CC:DD:EE:FF', connected: true } as any
const FILE_START = 7
const FILE_DATA = 8
const FILE_END = 9
// A reading above the floor, so no `ver` is sent
const BLE = '00.30.63'

const write = writeBinaryToDevice as jest.Mock
const fileOf = (packets: number) => new Uint8Array(packets * MAX_PAYLOAD_BYTES).fill(0x5a)
const say = (line: string) => bleEventBus.emitEvent({ type: 'TEXT_LINE', deviceId: PERIPHERAL.id, line, ts: Date.now() })
const sleep = () => bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.SLEEP, deviceId: PERIPHERAL.id, ts: Date.now() })

/**
 * A camera whose AI processor refuses the first `refusals` FILE_STARTs with
 * `ftx err 6`, as Seeed `dev` 56870445 does once it has begun to sleep and
 * unmounted the card (#555), and takes the file after that. `sleepAt` says
 * whether its Sleep reaches the app before the refusal is handled or a moment
 * after; `never` sends none. Returns the packet types written, in order.
 */
function camera({ refusals, sleepAt }: { refusals: number; sleepAt: 'with_refusal' | 'after' | 'never' }) {
    const types: number[] = []
    let refused = 0
    write.mockImplementation(async (_peripheral: unknown, packet: Uint8Array) => {
        types.push(packet[0])
        if (packet[0] === FILE_START) {
            if (refused < refusals) {
                refused++
                if (sleepAt === 'with_refusal') sleep()
                // Scheduled first: the refusal can throw out of the emitter
                if (sleepAt === 'after') setTimeout(sleep, 50)
                say('ftx err 6')
                return
            }
            say('ftx ack 0')
        }
        if (packet[0] === FILE_DATA && packet[1] % 4 === 0) say(`ftx ack ${packet[1]}`)
        if (packet[0] === FILE_END) say('ftx done')
    })
    return types
}

beforeEach(() => {
    jest.resetAllMocks()
    ;(NativeEventEmitter.prototype.addListener as jest.Mock).mockReturnValue({ remove: jest.fn() })
    ;(bleTransport.isBusy as jest.Mock).mockReturnValue(false)
    ;(bleTransport.enqueue as jest.Mock).mockImplementation((run: (signal: AbortSignal) => Promise<unknown>) => run(new AbortController().signal))
    ;(activateKeepAwakeAsync as jest.Mock).mockResolvedValue(undefined)
    ;(BleManager.requestConnectionPriority as jest.Mock).mockResolvedValue(undefined)
})

describe('runFileTransferPipeline, a file refused as the camera goes to sleep (#555)', () => {
    it('starts the file again after the Sleep that came with the refusal', async () => {
        const types = camera({ refusals: 1, sleepAt: 'with_refusal' })

        const result = await runFileTransferPipeline(PERIPHERAL, { filename: 'H6B27807.IMG', data: fileOf(8), bleFirmwareVersion: BLE })

        expect(result.success).toBe(true)
        expect(types.filter(t => t === FILE_START)).toHaveLength(2)
        expect(types[types.length - 1]).toBe(FILE_END)
    })

    it('waits for a Sleep that follows the refusal, then starts the file again', async () => {
        const types = camera({ refusals: 1, sleepAt: 'after' })

        // The test setup fakes timers: the camera's Sleep comes when time moves on
        const transfer = runFileTransferPipeline(PERIPHERAL, { filename: 'H6B27807.IMG', data: fileOf(8), bleFirmwareVersion: BLE })
        await jest.advanceTimersByTimeAsync(100)
        const result = await transfer

        expect(result.success).toBe(true)
        expect(types.filter(t => t === FILE_START)).toHaveLength(2)
    })

    it('starts it again only once, and a second refusal says what to do in words', async () => {
        const types = camera({ refusals: 2, sleepAt: 'with_refusal' })

        const transfer = runFileTransferPipeline(PERIPHERAL, { filename: 'H6B27807.IMG', data: fileOf(8), bleFirmwareVersion: BLE })

        await expect(transfer).rejects.toMatchObject({
            reason: 'DEVICE_ERROR',
            errorCode: 6,
            message: 'The camera could not open the file on its SD card. Check the card is in, then power cycle the camera. (ftx err 6)',
        })
        expect(types.filter(t => t === FILE_START)).toHaveLength(2)
    })

    it('does not start it again without a Sleep', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
        try {
            const types = camera({ refusals: 1, sleepAt: 'never' })

            const transfer = runFileTransferPipeline(PERIPHERAL, { filename: 'H6B27807.IMG', data: fileOf(8), bleFirmwareVersion: BLE })
            const settled = transfer.catch((e: unknown) => e)
            await jest.advanceTimersByTimeAsync(16_000)
            expect(await settled).toMatchObject({ reason: 'DEVICE_ERROR', errorCode: 6 })
            expect(types.filter(t => t === FILE_START)).toHaveLength(1)
        } finally {
            jest.useRealTimers()
        }
    })
})
