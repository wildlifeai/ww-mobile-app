import { withoutArchived } from '../projectArchive'

// #191: archiving takes a project out of the app's lists.
describe('withoutArchived', () => {
    it('keeps active projects and drops archived ones, in order', () => {
        const projects = [
            { id: 'a', is_archived: false },
            { id: 'b', is_archived: true },
            { id: 'c', is_archived: null },
            { id: 'd' },
        ]

        expect(withoutArchived(projects).map(p => p.id)).toEqual(['a', 'c', 'd'])
    })
})
