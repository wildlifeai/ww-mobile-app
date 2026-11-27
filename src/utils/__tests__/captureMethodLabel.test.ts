import { captureMethodLabel } from '../captureMethodLabel'

describe('captureMethodLabel (#563)', () => {
    it('words the reference identifiers', () => {
        expect(captureMethodLabel('activityDetection')).toBe('Motion detection')
        expect(captureMethodLabel('timeLapse')).toBe('Timelapse')
    })

    it('shows any other value as stored, and nothing as empty', () => {
        expect(captureMethodLabel('Motion Detection')).toBe('Motion Detection')
        expect(captureMethodLabel(null)).toBe('')
    })
})
