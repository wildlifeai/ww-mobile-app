import { syncAiModel } from '../deploymentPipeline'
import AiModelService from '../../../services/AiModelService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import { runFileTransferPipeline } from '../../protocol/fileTransfer'
import { crc16ccitt } from '../../protocol/fileTransfer/crc16ccitt'
import { FileTransferError } from '../../protocol/fileTransfer/fileTransferTypes'

jest.mock('../../../utils/logger', () => ({
    log: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
}))
jest.mock('../../../services/AiModelService', () => ({
    __esModule: true,
    default: {
        getModelById: jest.fn(),
        getModelFileExtensions: jest.fn(),
        ensureFilesDownloaded: jest.fn(),
        isDownloaded: jest.fn(),
        readModelAsBytes: jest.fn(),
    },
}))
jest.mock('../../protocol/fileTransfer', () => ({ runFileTransferPipeline: jest.fn() }))
jest.mock('../../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: { syncReferenceData: jest.fn(), getFirmwareIds: jest.fn() },
}))

const getModelById = AiModelService.getModelById as jest.Mock
const syncReferenceData = ReferenceDataService.syncReferenceData as jest.Mock
const getFirmwareIds = ReferenceDataService.getFirmwareIds as jest.Mock

/**
 * A project that names a model must not start monitoring without it. The
 * pipeline used to log a warning and carry on, so the camera ran with no model
 * and the Himax said `No model found` on every wake (#290). The refusal comes
 * before the deployment is created and before anything is written to the
 * device, which is why these tests also check the session is never used.
 */
describe('syncAiModel with a project model the phone cannot resolve', () => {
    const MODEL_ID = 'd0000000-0000-4000-8000-0000000000a1'
    const callbacks = () => ({ addLog: jest.fn(), setStep: jest.fn(), setProgress: jest.fn() })
    const session = () => ({ execute: jest.fn() })

    beforeEach(() => {
        jest.resetAllMocks()
    })

    it('syncs once, looks again, then refuses with the model named', async () => {
        getModelById.mockResolvedValue(null)
        const bleSession = session()

        await expect(syncAiModel({} as any, bleSession as any, MODEL_ID, callbacks(), true, ['0']))
            .rejects.toThrow(/AI model \(d0000000\) is not on this phone/)

        expect(syncReferenceData).toHaveBeenCalledTimes(1)
        expect(getModelById).toHaveBeenCalledTimes(2)
        expect(bleSession.execute).not.toHaveBeenCalled()
    })

    it('still refuses when the sync itself fails, as it will offline', async () => {
        getModelById.mockResolvedValue(null)
        syncReferenceData.mockRejectedValue(new Error('Network request failed'))

        await expect(syncAiModel({} as any, session() as any, MODEL_ID, callbacks(), true, ['0']))
            .rejects.toThrow(/is not on this phone/)
    })

    it('refuses when the model has no firmware IDs to load it under', async () => {
        getModelById.mockResolvedValue({ name: 'Rat Detection v1' })
        getFirmwareIds.mockRejectedValue(new Error('AI model "Rat Detection v1" has no version_number. Sync may be stale.'))
        const bleSession = session()

        await expect(syncAiModel({} as any, bleSession as any, MODEL_ID, callbacks(), true, ['0']))
            .rejects.toThrow(/"Rat Detection v1" cannot be loaded on the camera/)

        expect(bleSession.execute).not.toHaveBeenCalled()
    })

    it('does not look for a model when the project has none', async () => {
        const cb = callbacks()

        await syncAiModel({} as any, session() as any, null, cb, false)

        expect(getModelById).not.toHaveBeenCalled()
        expect(cb.addLog).toHaveBeenCalledWith('No AI model required')
    })
})

/**
 * A model file already on the card, with the same checksum and size as the
 * one the phone would send, must not be sent again. The comparison upper-cased
 * the device's `0xDB68` to `0XDB68` and compared it with `0xDB68`, so every
 * file read as different and was re-sent on every deployment: 13 s for a 73 KB
 * model on the bench on 29 September 2026, minutes for a large one.
 */
describe('syncAiModel with the model files already on the card', () => {
    const MODEL_ID = 'd0000000-0000-4000-8000-0000000000a1'
    const model = new Uint8Array([0x28, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33, 1, 2, 3])
    const labels = new Uint8Array([0x72, 0x61, 0x74])
    const hex = (bytes: Uint8Array) => `0x${crc16ccitt(bytes).toString(16).toUpperCase().padStart(4, '0')}`

    beforeEach(() => {
        jest.resetAllMocks()
        ;(AiModelService.getModelById as jest.Mock).mockResolvedValue({ name: 'Rat Detection', labelsPath: 'x/7V1.txt' })
        ;(ReferenceDataService.getFirmwareIds as jest.Mock).mockResolvedValue({ firmwareModelId: 7, versionNumber: 1 })
        ;(AiModelService.getModelFileExtensions as jest.Mock).mockReturnValue({ modelExt: 'tfl', labelsExt: 'txt' })
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockResolvedValue({ modelUri: 'file://m', labelsUri: 'file://l' })
        ;(AiModelService.readModelAsBytes as jest.Mock).mockImplementation(async (uri: string) => (uri === 'file://m' ? model : labels))
    })

    it('verifies them by checksum and loads without sending anything', async () => {
        const sent: string[] = []
        const session = {
            execute: jest.fn(async (build: any) => {
                const line: string = build().build()
                sent.push(line)
                if (line === 'AI dir') return ['7V1.TFL 11', '7V1.TXT 3']
                if (line === 'AI crc 7V1.TFL') return { crc: hex(model), sizeBytes: model.length }
                if (line === 'AI crc 7V1.TXT') return { crc: hex(labels), sizeBytes: labels.length }
                return true
            }),
        }
        const cb = { addLog: jest.fn(), setStep: jest.fn(), setProgress: jest.fn() }
        const ops = Array.from({ length: 37 }, () => '0')

        await syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops)

        expect(runFileTransferPipeline).not.toHaveBeenCalled()
        expect(sent).toContain('AI loadmodel 7 1')
        expect(cb.addLog).toHaveBeenCalledWith(`✅ 7V1.TFL on the card matches (${hex(model)})`)
    })
})

/**
 * Offline, a model whose files never reached the phone went out as a warning:
 * `Downloading missing model files...`, then `AI model update FAILED`, then
 * `Deployment started successfully` with no model loaded (Pixel 7 in airplane
 * mode, 29 September 2026, #333). Files the phone cannot get now stop the
 * deployment before anything is written to the camera. Files the camera or
 * the card already holds need no download, and a failure once the files are
 * in hand (the transfer, the load) stays the warning it was.
 */
describe('syncAiModel when the model files cannot be downloaded', () => {
    const MODEL_ID = 'd0000000-0000-4000-8000-0000000000a1'
    const model = new Uint8Array([0x28, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33, 1, 2, 3])
    const labels = new Uint8Array([0x72, 0x61, 0x74])
    const offline = new Error('Could not get signed URL: Network request failed')
    const ops = (id = '0', ver = '0') => Array.from({ length: 37 }, (_, i) => (i === 14 ? id : i === 15 ? ver : '0'))

    /** A device whose card holds `files`, recording every line sent to it. */
    const device = (files: string[]) => {
        const sent: string[] = []
        const session = {
            execute: jest.fn(async (build: any) => {
                const line: string = build().build()
                sent.push(line)
                if (line === 'AI dir') return files
                return true
            }),
        }
        return { session, sent }
    }
    const callbacks = () => ({ addLog: jest.fn(), setStep: jest.fn(), setProgress: jest.fn() })

    beforeEach(() => {
        jest.resetAllMocks()
        ;(AiModelService.getModelById as jest.Mock).mockResolvedValue({ name: 'Rat Detection', labelsPath: 'x/7V1.txt' })
        ;(ReferenceDataService.getFirmwareIds as jest.Mock).mockResolvedValue({ firmwareModelId: 7, versionNumber: 1 })
        ;(AiModelService.getModelFileExtensions as jest.Mock).mockReturnValue({ modelExt: 'tfl', labelsExt: 'txt' })
        ;(AiModelService.isDownloaded as jest.Mock).mockResolvedValue(false)
        ;(AiModelService.readModelAsBytes as jest.Mock).mockImplementation(async (uri: string) => (uri === 'file://m' ? model : labels))
    })

    it('stops before writing anything when neither the card nor the phone has them', async () => {
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockRejectedValue(offline)
        const { session, sent } = device([])
        const cb = callbacks()

        await expect(syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops()))
            .rejects.toThrow('This project\'s AI model "Rat Detection" could not be downloaded, and it is not on the camera or this phone. Check the phone\'s connection and start again.')

        // Only the read that found the card empty went out
        expect(sent).toEqual(['AI dir'])
        expect(runFileTransferPipeline).not.toHaveBeenCalled()
        expect(cb.addLog).not.toHaveBeenCalledWith(expect.stringMatching(/update FAILED/))
    })

    it('stops when the model is on the card but its labels are not and cannot be had', async () => {
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockRejectedValue(offline)
        const { session, sent } = device(['7V1.TFL 11'])

        await expect(syncAiModel({} as any, session as any, MODEL_ID, callbacks(), true, ops()))
            .rejects.toThrow(/could not be downloaded, and it is not on the camera or this phone/)

        expect(sent).not.toContain('AI loadmodel 7 1')
        expect(runFileTransferPipeline).not.toHaveBeenCalled()
    })

    it('needs nothing from the phone when the camera already runs the model', async () => {
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockRejectedValue(offline)
        const { session, sent } = device([])
        const cb = callbacks()

        await syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops('7', '1'))

        expect(AiModelService.ensureFilesDownloaded).not.toHaveBeenCalled()
        expect(sent).toEqual([])
        expect(cb.addLog).toHaveBeenCalledWith('AI model up to date')
    })

    it('loads the files already on the card when the phone cannot fetch them to check', async () => {
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockRejectedValue(offline)
        const { session, sent } = device(['7V1.TFL 11', '7V1.TXT 3'])

        await syncAiModel({} as any, session as any, MODEL_ID, callbacks(), true, ops())

        expect(runFileTransferPipeline).not.toHaveBeenCalled()
        expect(sent).toContain('AI loadmodel 7 1')
    })

    it('sends the copy already on the phone without a connection', async () => {
        ;(AiModelService.isDownloaded as jest.Mock).mockResolvedValue(true)
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockResolvedValue({ modelUri: 'file://m', labelsUri: 'file://l' })
        const { session, sent } = device([])
        const cb = callbacks()

        await syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops())

        expect(cb.addLog).toHaveBeenCalledWith('Model files are on this phone')
        expect((runFileTransferPipeline as jest.Mock).mock.calls.map(([, opts]) => opts.filename)).toEqual(['7V1.TFL', '7V1.TXT'])
        expect(sent).toContain('AI loadmodel 7 1')
    })

    it('keeps a failed transfer a warning, since the files were in hand', async () => {
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockResolvedValue({ modelUri: 'file://m', labelsUri: 'file://l' })
        ;(runFileTransferPipeline as jest.Mock).mockRejectedValue(new Error('DEVICE_DISCONNECTED'))
        const { session } = device([])
        const cb = callbacks()

        await syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops())

        expect(cb.addLog).toHaveBeenCalledWith(expect.stringMatching(/AI model update FAILED/))
    })
})

/**
 * BLE firmware below 0.30.47 cannot take the windowed transfer, and the
 * pipeline refuses it before FILE_START (#289). In a deployment that refusal
 * stops the start like files the phone cannot get: nothing has been written
 * to the camera, and a retry meets the same firmware.
 */
describe('syncAiModel when the camera BLE firmware is too old for the transfer', () => {
    const MODEL_ID = 'd0000000-0000-4000-8000-0000000000a1'
    const model = new Uint8Array([0x28, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33, 1, 2, 3])
    const labels = new Uint8Array([0x72, 0x61, 0x74])
    const ops = Array.from({ length: 37 }, () => '0')
    const refusal = "This camera's BLE firmware is 0.23.29, and sending files to it needs 0.30.47 or later. Update the BLE firmware first, then try again."

    const device = () => {
        const sent: string[] = []
        const session = {
            execute: jest.fn(async (build: any) => {
                const line: string = build().build()
                sent.push(line)
                if (line === 'AI dir') return []
                return true
            }),
        }
        return { session, sent }
    }
    const callbacks = () => ({ addLog: jest.fn(), setStep: jest.fn(), setProgress: jest.fn() })

    beforeEach(() => {
        jest.resetAllMocks()
        ;(AiModelService.getModelById as jest.Mock).mockResolvedValue({ name: 'Rat Detection', labelsPath: 'x/7V1.txt' })
        ;(ReferenceDataService.getFirmwareIds as jest.Mock).mockResolvedValue({ firmwareModelId: 7, versionNumber: 1 })
        ;(AiModelService.getModelFileExtensions as jest.Mock).mockReturnValue({ modelExt: 'tfl', labelsExt: 'txt' })
        ;(AiModelService.isDownloaded as jest.Mock).mockResolvedValue(true)
        ;(AiModelService.ensureFilesDownloaded as jest.Mock).mockResolvedValue({ modelUri: 'file://m', labelsUri: 'file://l' })
        ;(AiModelService.readModelAsBytes as jest.Mock).mockImplementation(async (uri: string) => (uri === 'file://m' ? model : labels))
    })

    it('stops the deployment with the refusal, instead of warning and deploying without the model', async () => {
        ;(runFileTransferPipeline as jest.Mock).mockRejectedValue(new FileTransferError('BLE_FIRMWARE_TOO_OLD', refusal))
        const { session, sent } = device()
        const cb = callbacks()

        await expect(syncAiModel({} as any, session as any, MODEL_ID, cb, true, ops, '00.23.29'))
            .rejects.toThrow(refusal)

        expect(runFileTransferPipeline).toHaveBeenCalledTimes(1)
        expect(sent).not.toContain('AI loadmodel 7 1')
        expect(cb.addLog).toHaveBeenCalledWith("The camera's BLE firmware is too old to receive the model, stopping")
        expect(cb.addLog).not.toHaveBeenCalledWith(expect.stringMatching(/update FAILED/))
    })

    it('hands the reading the caller already holds to each transfer', async () => {
        const { session } = device()

        await syncAiModel({} as any, session as any, MODEL_ID, callbacks(), true, ops, '00.30.51')

        const transfers = (runFileTransferPipeline as jest.Mock).mock.calls.map(([, opts]) => [opts.filename, opts.bleFirmwareVersion])
        expect(transfers).toEqual([['7V1.TFL', '00.30.51'], ['7V1.TXT', '00.30.51']])
    })
})
