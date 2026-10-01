import { runFileTransferPipeline } from '../runFileTransferPipeline'
import { FileTransferError, MAX_PAYLOAD_BYTES } from '../fileTransferTypes'
import { writeBinaryToDevice } from '../../../transport'
import { runCommandPipeline } from '../../runCommandPipeline'
import { bleTransport } from '../../bleTransportController'
import { bleEventBus } from '../../eventBus'
import { activateKeepAwakeAsync } from 'expo-keep-awake'
import BleManager from 'react-native-ble-manager'
import { NativeEventEmitter } from 'react-native'

jest.mock('../../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))
jest.mock('react-native-ble-manager', () => ({
    __esModule: true,
    default: { requestConnectionPriority: jest.fn() },
}))
jest.mock('expo-keep-awake', () => ({
    activateKeepAwakeAsync: jest.fn(),
    deactivateKeepAwake: jest.fn(),
}))
jest.mock('../../../transport', () => ({ writeBinaryToDevice: jest.fn() }))
jest.mock('../../runCommandPipeline', () => ({ runCommandPipeline: jest.fn() }))
jest.mock('../../bleTransportController', () => ({
    bleTransport: { isBusy: jest.fn(), acquireLock: jest.fn(), releaseLock: jest.fn(), enqueue: jest.fn() },
}))

const PERIPHERAL = { id: 'AA:BB:CC:DD:EE:FF', connected: true } as any
const FILE_START = 7
const FILE_DATA = 8
const FILE_END = 9

const write = writeBinaryToDevice as jest.Mock
const command = runCommandPipeline as jest.Mock

/** A file of `packets` full FILE_DATA packets. */
const fileOf = (packets: number) => new Uint8Array(packets * MAX_PAYLOAD_BYTES).fill(0x5a)

const say = (line: string) => bleEventBus.emitEvent({ type: 'TEXT_LINE', deviceId: PERIPHERAL.id, line, ts: Date.now() })

/**
 * The nRF and Himax as the app sees them: `ftx ack 0` for FILE_START, an ack
 * every `ackEvery` data packets, `ftx done` for FILE_END. 0.30.47 and later
 * ack every 4th packet. `silentAfter` stops everything after that data
 * packet, the way pre-FIFO firmware does once the window overruns its one
 * relay slot. Returns the packet types written, in order.
 */
function camera({ ackEvery = 4, silentAfter }: { ackEvery?: number; silentAfter?: number } = {}) {
    const types: number[] = []
    let silent = false
    write.mockImplementation(async (_peripheral: unknown, packet: Uint8Array) => {
        types.push(packet[0])
        if (silent) return
        if (packet[0] === FILE_START) say('ftx ack 0')
        if (packet[0] === FILE_DATA) {
            const wire = packet[1]
            if (wire % ackEvery === 0 || wire === silentAfter) say(`ftx ack ${wire}`)
            if (wire === silentAfter) silent = true
        }
        if (packet[0] === FILE_END) say('ftx done')
    })
    return types
}

/** What the camera answers to `ver`, or null for no answer. */
function verAnswers(reply: string | null) {
    command.mockImplementation(async () => {
        if (reply === null) throw new Error('Command timed out after 6000ms')
        return reply
    })
}

const verSent = () => command.mock.calls.filter(([, build]) => build().build() === 'ver').length

beforeEach(() => {
    jest.resetAllMocks()
    // The test setup automocks NativeEventEmitter, and the pipeline's
    // disconnect watch removes its subscription when it finishes
    ;(NativeEventEmitter.prototype.addListener as jest.Mock).mockReturnValue({ remove: jest.fn() })
    ;(bleTransport.isBusy as jest.Mock).mockReturnValue(false)
    ;(bleTransport.enqueue as jest.Mock).mockImplementation((run: (signal: AbortSignal) => Promise<unknown>) => run(new AbortController().signal))
    ;(activateKeepAwakeAsync as jest.Mock).mockResolvedValue(undefined)
    ;(BleManager.requestConnectionPriority as jest.Mock).mockResolvedValue(undefined)
})

/**
 * Pre-FIFO BLE firmware (ww-hardware `main`, 0.23.x) drops what its one relay
 * slot cannot take and never says so, and the transfer used to hang for 15 s
 * before reporting a stuck device (#289, Charles Palmer, 5 September 2026).
 * The pipeline now reads the version before anything is sent and refuses
 * below the floor.
 */
describe('runFileTransferPipeline and the BLE firmware floor', () => {
    it('refuses below 0.30.47 before FILE_START, naming the version', async () => {
        const types = camera()
        verAnswers('00.23.29')

        const transfer = runFileTransferPipeline(PERIPHERAL, { filename: 'R6905142.IMG', data: fileOf(30) })

        await expect(transfer).rejects.toThrow(new FileTransferError(
            'BLE_FIRMWARE_TOO_OLD',
            "This camera's BLE firmware is 0.23.29, and sending files to it needs 0.30.47 or later. Update the BLE firmware first, then try again.",
        ))
        await expect(transfer).rejects.toMatchObject({ reason: 'BLE_FIRMWARE_TOO_OLD' })
        expect(types).toEqual([])
        expect(bleTransport.acquireLock).not.toHaveBeenCalled()
        expect(verSent()).toBe(1)
        expect(command.mock.calls[0][2]).toMatchObject({ maxRetries: 0 })
    })

    it('sends no `ver` when the caller already holds a reading that clears the floor', async () => {
        const types = camera()

        const result = await runFileTransferPipeline(PERIPHERAL, { filename: '1V1.TFL', data: fileOf(30), bleFirmwareVersion: '00.30.51' })

        expect(result.success).toBe(true)
        expect(command).not.toHaveBeenCalled()
        expect(types[0]).toBe(FILE_START)
        expect(types[types.length - 1]).toBe(FILE_END)
    })

    it('checks a caller reading below the floor with one `ver` before refusing, since a BLE update makes it stale', async () => {
        const types = camera()
        verAnswers('WW500-C02 V 00.30.51 08:16:11 Sep 18 2026')

        const result = await runFileTransferPipeline(PERIPHERAL, { filename: '1V1.TFL', data: fileOf(30), bleFirmwareVersion: '00.23.29' })

        expect(result.success).toBe(true)
        expect(verSent()).toBe(1)
        expect(types[0]).toBe(FILE_START)
    })

    it('goes ahead with the window when `ver` gets no answer', async () => {
        const types = camera()
        verAnswers(null)

        const result = await runFileTransferPipeline(PERIPHERAL, { filename: '1V1.TFL', data: fileOf(30) })

        expect(result.success).toBe(true)
        expect(verSent()).toBe(1)
        expect(types.filter(t => t === FILE_DATA)).toHaveLength(30)
    })

    it('does not check a stop-and-wait transfer, the one mode firmware below the floor can take', async () => {
        const types = camera({ ackEvery: 1 })

        const result = await runFileTransferPipeline(PERIPHERAL, { filename: 'TINY.TXT', data: fileOf(3), windowSize: 1 })

        expect(result.success).toBe(true)
        expect(command).not.toHaveBeenCalled()
        expect(types).toEqual([FILE_START, FILE_DATA, FILE_DATA, FILE_DATA, FILE_END])
    })
})

describe('runFileTransferPipeline when the camera goes silent mid-window', () => {
    /** Starts the transfer, lets the silence timeout pass, returns the error. */
    async function silentTransfer(bleFirmwareVersion?: string) {
        camera({ ackEvery: 1, silentAfter: 1 })
        const failure = runFileTransferPipeline(PERIPHERAL, { filename: 'R6905142.IMG', data: fileOf(30), bleFirmwareVersion })
            .then(() => null, (e: unknown) => e)
        await jest.advanceTimersByTimeAsync(15_000)
        return failure
    }

    it('says the BLE firmware may be too old when the version could not be read', async () => {
        verAnswers(null)

        const err = await silentTransfer()

        expect(err).toBeInstanceOf(FileTransferError)
        expect(err).toMatchObject({
            reason: 'DEVICE_SILENT',
            message: 'The camera acknowledged 1 of the 13 packets sent, then went silent. ' +
                'Its BLE firmware version could not be read, and it may be older than 0.30.47, ' +
                'which does not support streamed transfers. If it is, update the BLE firmware, then try again.',
        })
    })

    it('keeps the stuck-device message when the version is known to clear the floor', async () => {
        const err = await silentTransfer('00.30.51')

        expect(err).toMatchObject({
            reason: 'DEVICE_SILENT',
            message: 'No transfer response for 15 seconds, device may be stuck',
        })
    })
})
