import * as fs from 'fs'
import * as path from 'path'

import schema from '../../database/schema'

/**
 * Every column of the local `projects` table must be copied by the project
 * pull, in both of its branches (update and create).
 *
 * The pull names its columns by hand, so a column the schema gains is dropped
 * until someone remembers it. `record_gps_in_images`, `lorawan_required` and
 * `is_archived` were missing for months, and a project with GPS turned on from
 * the website deployed with GPS zeroed on every phone (#285). The four flash
 * columns were only caught because #282 went through this function. This test
 * reads the function's source, so a new column fails here instead of in the
 * field.
 */
describe('SupabaseSyncService.syncProjects column coverage', () => {
    /** Kept by the sync machinery itself, not copied field by field. */
    const BOOKKEEPING = new Set(['created_at', 'updated_at', 'deleted_at', '_version', '_custom_sync_status'])

    const source = fs.readFileSync(path.join(__dirname, '..', 'SupabaseSyncService.ts'), 'utf8')
    const start = source.indexOf('private async syncProjects(')
    const end = source.indexOf('\n    private async ', start + 1)
    const syncProjects = source.slice(start, end === -1 ? undefined : end)

    const columns = Object.keys(schema.tables.projects.columns).filter(name => !BOOKKEEPING.has(name))

    it('finds the function and the table', () => {
        expect(start).toBeGreaterThan(-1)
        expect(columns).toContain('record_gps_in_images')
    })

    it.each(columns)('copies %s in both branches', (column) => {
        const reads = syncProjects.split(`row.${column}`).length - 1
        expect(reads).toBeGreaterThanOrEqual(2)
    })
})
