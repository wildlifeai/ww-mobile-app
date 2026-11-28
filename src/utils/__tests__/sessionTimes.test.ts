import { formatSessionDate, formatSessionDuration } from '../sessionTimes'

const START = new Date('2026-11-28T01:00:00Z')
const after = (minutes: number) => new Date(START.getTime() + minutes * 60 * 1000)

describe('formatSessionDuration (#575)', () => {
    it('shows minutes under an hour, where a 4-minute session read "0 hours"', () => {
        expect(formatSessionDuration(START, after(4))).toBe('4 min')
        expect(formatSessionDuration(START, after(0))).toBe('0 min')
    })

    it('shows hours and minutes under a day', () => {
        expect(formatSessionDuration(START, after(65))).toBe('1 hour 5 min')
        expect(formatSessionDuration(START, after(120))).toBe('2 hours')
    })

    it('shows days and hours from a day', () => {
        expect(formatSessionDuration(START, after(2 * 24 * 60 + 3 * 60 + 10))).toBe('2 days and 3 hours')
        expect(formatSessionDuration(START, after(24 * 60 + 60))).toBe('1 day and 1 hour')
    })

    it('runs an open session to now', () => {
        expect(formatSessionDuration(START, null, after(30))).toBe('30 min')
    })

    it('says nothing for a missing start or an end before it', () => {
        expect(formatSessionDuration(null, after(4))).toBe('--')
        expect(formatSessionDuration(after(4), START)).toBe('--')
    })
})

describe('formatSessionDate (#575)', () => {
    it('shows the time with the date', () => {
        const d = new Date(2026, 10, 28, 14, 5)
        const shown = formatSessionDate(d)
        expect(shown).toContain(d.toLocaleDateString())
        expect(shown).toMatch(/\b0?2:05\b|\b14:05\b/)
    })

    it('says Unknown for no date or a placeholder', () => {
        expect(formatSessionDate(null)).toBe('Unknown')
        expect(formatSessionDate(0)).toBe('Unknown')
    })
})
