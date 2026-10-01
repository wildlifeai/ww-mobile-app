import { DeploymentPhotoService } from '../DeploymentPhotoService'

/**
 * #347: Start Monitoring starts a photo upload for the new deployment and the
 * sync it triggers starts another. Side by side, the second found the file the
 * first had just uploaded and deleted, dropped it, and wrote its own path list
 * over the first's, so the photo sat in the bucket with nothing pointing at it.
 */

const LOCAL = 'file:///docs/deployment-photos/1-a.jpeg'
const LOCAL_2 = 'file:///docs/deployment-photos/2-b.jpeg'

const mockFiles = new Set<string>()
const mockRecord: { id: string; projectId: string; cameraLocationImagePaths: string[]; modifiedBy?: string } = {
    id: 'dep-1',
    projectId: 'proj-1',
    cameraLocationImagePaths: [],
}
let mockReleaseUpload: (() => void) | null = null
const mockUpload = jest.fn(() => new Promise<{ error: null }>(resolve => {
    mockReleaseUpload = () => resolve({ error: null })
}))
const mockBucket = new Set<string>()
const mockList = jest.fn(async (folder: string, { search }: { search: string }) =>
    mockBucket.has(`${folder}/${search}`) ? { data: [{ name: search }], error: null } : { data: [], error: null })

jest.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///docs/',
    EncodingType: { Base64: 'base64' },
    getInfoAsync: jest.fn(async (path: string) => ({ exists: mockFiles.has(path) })),
    readAsStringAsync: jest.fn(async () => 'AAAA'),
    deleteAsync: jest.fn(async (path: string) => { mockFiles.delete(path) }),
}))

jest.mock('../../database', () => ({
    __esModule: true,
    default: {
        get: () => ({
            find: async () => ({
                ...mockRecord,
                cameraLocationImagePaths: [...mockRecord.cameraLocationImagePaths],
                prepareUpdate: (fn: (r: typeof mockRecord) => void) => {
                    fn(mockRecord)
                    return { kind: 'update' }
                },
            }),
        }),
        write: async (fn: () => Promise<void>) => fn(),
        batch: async () => undefined,
    },
}))

jest.mock('../OutboxService', () => ({ __esModule: true, default: { recordOperation: jest.fn(() => ({ kind: 'outbox' })) } }))
jest.mock('../DeploymentService', () => ({ mapModelToPayload: jest.fn(() => ({})) }))
jest.mock('../SupabaseSyncService', () => ({ __esModule: true, default: { debouncedSync: jest.fn() } }))
jest.mock('../supabase', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ upload: mockUpload, list: mockList }) } }) }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/** Let the pending promise chains run as far as they can. */
const settle = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve()
}

describe('DeploymentPhotoService.uploadPendingPhotos', () => {
    beforeEach(() => {
        mockFiles.clear()
        mockBucket.clear()
        mockReleaseUpload = null
        mockUpload.mockClear()
        mockList.mockClear()
    })

    it('keeps the photo when two uploads for the same deployment start together', async () => {
        mockFiles.add(LOCAL)
        mockRecord.cameraLocationImagePaths = [LOCAL]

        const fromStartMonitoring = DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')
        const fromSync = DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')
        await settle()
        mockReleaseUpload?.()
        await Promise.all([fromStartMonitoring, fromSync])

        expect(mockUpload).toHaveBeenCalledTimes(1)
        expect(mockRecord.cameraLocationImagePaths).toEqual(['proj-1/dep-1/1-a.jpeg'])
    })

    it('keeps a photo added while an upload was running', async () => {
        mockFiles.add(LOCAL)
        mockRecord.cameraLocationImagePaths = [LOCAL]

        const pass = DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')
        await settle()
        mockFiles.add(LOCAL_2)
        mockRecord.cameraLocationImagePaths = [LOCAL, LOCAL_2]
        mockReleaseUpload?.()
        await pass

        expect(mockRecord.cameraLocationImagePaths).toEqual(['proj-1/dep-1/1-a.jpeg', LOCAL_2])
    })

    // Seen on the bench: a sync pull put the record's older copy back, with the
    // local path of a photo already uploaded and deleted from the phone
    it('points a local photo whose file is gone at its copy in the bucket', async () => {
        mockBucket.add('proj-1/dep-1/1-a.jpeg')
        mockRecord.cameraLocationImagePaths = [LOCAL]

        await DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')

        expect(mockUpload).not.toHaveBeenCalled()
        expect(mockRecord.cameraLocationImagePaths).toEqual(['proj-1/dep-1/1-a.jpeg'])
    })

    it('drops a local photo whose file is gone and that the bucket does not have', async () => {
        mockRecord.cameraLocationImagePaths = [LOCAL, 'proj-1/dep-1/0-old.jpeg']

        await DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')

        expect(mockUpload).not.toHaveBeenCalled()
        expect(mockRecord.cameraLocationImagePaths).toEqual(['proj-1/dep-1/0-old.jpeg'])
    })

    it('keeps a local photo whose file is gone when the bucket cannot be asked', async () => {
        mockList.mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } } as any)
        mockRecord.cameraLocationImagePaths = [LOCAL]

        await DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')

        expect(mockRecord.cameraLocationImagePaths).toEqual([LOCAL])
    })
})
