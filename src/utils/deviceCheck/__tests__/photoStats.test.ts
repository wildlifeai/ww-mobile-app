import { photoProblem } from '../photoStats'

describe('photoProblem', () => {
    it('passes a real photo', () => {
        expect(photoProblem(30000, 120)).toBeNull()
        expect(photoProblem(30000)).toBeNull()
    })

    it('names what is wrong with a bad one', () => {
        expect(photoProblem(1200, 120)).toMatch(/almost nothing/)
        expect(photoProblem(30000, 3)).toMatch(/black/)
        expect(photoProblem(30000, 252)).toMatch(/white/)
    })
})
