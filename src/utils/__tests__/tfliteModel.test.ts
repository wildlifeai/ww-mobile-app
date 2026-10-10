import { describeModelFile, isTfliteModel } from '../tfliteModel'

/**
 * The check a model file passes before any of it is sent to the camera
 * (#428). A TFLite model carries `TFL3` at bytes 4 to 7; the dev backend's
 * model was a ZIP archive, and `loadmodel` on it halted the Himax (Seeed #241).
 */
describe('tfliteModel', () => {
    // The first bytes of a Vela-compiled 98V1.TFL and of the file sent on the bench
    const vela = new Uint8Array([0x24, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33, 0, 0, 0x12, 0])
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0x08, 0])

    describe('isTfliteModel', () => {
        it('accepts a file whose bytes 4 to 7 read TFL3', () => {
            expect(isTfliteModel(vela)).toBe(true)
        })

        it('accepts the first 8 bytes alone', () => {
            expect(isTfliteModel(vela.subarray(0, 8))).toBe(true)
        })

        it('refuses a ZIP archive', () => {
            expect(isTfliteModel(zip)).toBe(false)
        })

        it('refuses TFL3 anywhere but bytes 4 to 7', () => {
            expect(isTfliteModel(new Uint8Array([0x54, 0x46, 0x4c, 0x33, 0, 0, 0, 0]))).toBe(false)
            expect(isTfliteModel(new Uint8Array([0, 0, 0, 0, 0, 0x54, 0x46, 0x4c, 0x33]))).toBe(false)
        })

        it('refuses a file too short to carry the identifier', () => {
            expect(isTfliteModel(new Uint8Array([]))).toBe(false)
            expect(isTfliteModel(vela.subarray(0, 7))).toBe(false)
        })
    })

    describe('describeModelFile', () => {
        it('names a ZIP archive', () => {
            expect(describeModelFile(zip)).toBe('is a ZIP archive')
        })

        it('shows anything else by its first bytes', () => {
            const html = new TextEncoder().encode('<!DOCTYPE html>')
            expect(describeModelFile(html)).toBe('starts 3C 21 44 4F 43 54 59 50')
        })

        it('says when the file is empty', () => {
            expect(describeModelFile(new Uint8Array([]))).toBe('is empty')
        })

        it('says when the file is a model', () => {
            expect(describeModelFile(vela)).toBe('is a TFLite model')
        })
    })
})
