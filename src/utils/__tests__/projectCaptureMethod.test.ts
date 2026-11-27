import { captureMethodOf, captureMethodRefusal, NO_CAPTURE_METHOD } from '../projectCaptureMethod'

describe('projectCaptureMethod (#561)', () => {
    it('maps the capture_methods ids the deployment writes', () => {
        expect(captureMethodOf(1)).toBe('activity')
        expect(captureMethodOf(2)).toBe('timelapse')
        expect(captureMethodOf(3)).toBe('mixed')
    })

    it('knows no other id, and none', () => {
        expect(captureMethodOf(4)).toBe('unknown')
        expect(captureMethodOf(null)).toBe('unknown')
        expect(captureMethodOf(undefined)).toBe('unknown')
    })

    it('refuses only a project without a method it knows', () => {
        expect(captureMethodRefusal(1)).toBeNull()
        expect(captureMethodRefusal(null)).toBe(NO_CAPTURE_METHOD)
        expect(captureMethodRefusal(9)).toBe(NO_CAPTURE_METHOD)
    })
})
