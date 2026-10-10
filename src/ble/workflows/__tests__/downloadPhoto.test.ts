jest.mock('../../protocol/connectionPriority', () => ({
    requestFastInterval: jest.fn(() => Promise.resolve()),
    releaseFastInterval: jest.fn(),
}))
jest.mock('../../../utils/logger', () => ({ log: jest.fn() }))

import { imageReassemblerEmitter } from '../../emitters'
import { requestFastInterval, releaseFastInterval } from '../../protocol/connectionPriority'
import { downloadPhoto } from '../downloadPhoto'

const request = requestFastInterval as jest.Mock
const release = releaseFastInterval as jest.Mock

beforeEach(() => {
    request.mockReset()
    request.mockImplementation(() => Promise.resolve())
    release.mockReset()
})

// Microtasks only: tests/setup/sanitySetup.ts turns fake timers on for every test.
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe('downloadPhoto connection priority', () => {
    it('asks for the fast interval before txfile and gives it back when the photo arrives', async () => {
        const order: string[] = []
        request.mockImplementationOnce(async () => { order.push('priority') })
        const session = { execute: jest.fn(async () => { order.push('txfile') }) as any }

        const done = downloadPhoto(session, 'dev_a', 'IMG001.JPG')
        await flush()
        expect(order).toEqual(['priority', 'txfile'])
        expect(release).not.toHaveBeenCalled()

        imageReassemblerEmitter.emit('onImageComplete', 'file://IMG001.JPG')
        await expect(done).resolves.toEqual({ uri: 'file://IMG001.JPG', bytes: null })
        expect(request).toHaveBeenCalledWith('dev_a')
        expect(release).toHaveBeenCalledWith('dev_a')
    })

    it('gives the fast interval back when txfile fails', async () => {
        const session = { execute: jest.fn(async () => { throw new Error('TIMEOUT') }) as any }

        await expect(downloadPhoto(session, 'dev_a', 'IMG002.JPG')).rejects.toThrow('TIMEOUT')
        expect(release).toHaveBeenCalledWith('dev_a')
    })
})
