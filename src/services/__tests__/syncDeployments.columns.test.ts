import * as fs from 'fs'
import * as path from 'path'

import schema from '../../database/schema'

/**
 * Every column of the local `deployments` table, and every column the push
 * sends, must be copied by the deployment pull, in both of its branches
 * (update and create).
 *
 * The pull names its columns by hand, as the project pull does
 * (syncProjects.columns.test.ts). The start snapshot, camera_model through
 * lorawan_snr_at_start, was pushed but never read back, so a deployment
 * pulled onto a second phone had none (#426). This test reads the function's
 * source, so a new column fails here instead of on that phone.
 */
describe('SupabaseSyncService.syncDeployments column coverage', () => {
    /** Kept by the sync machinery itself, not copied field by field. */
    const BOOKKEEPING = new Set(['created_at', 'updated_at', 'deleted_at', '_version', '_custom_sync_status'])
    /**
     * Server columns the phone keeps no field for: the CamtrapDP details the
     * website edits (ww-backend #170), and location_data. A field added for
     * one of them needs a pull line, so the last test fails until it leaves
     * this list.
     */
    const NO_FIELD = new Set([
        'bait_use', 'camera_tilt', 'deployment_tags', 'detection_distance', 'feature_type', 'habitat',
        'location_data', 'timezone',
    ])

    const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

    const syncSource = read('SupabaseSyncService.ts')
    const start = syncSource.indexOf('private async syncDeployments(')
    const end = syncSource.indexOf('\n    private async ', start + 1)
    const syncDeployments = syncSource.slice(start, end === -1 ? undefined : end)
    const updateAt = syncDeployments.indexOf('existing.update(')
    const createAt = syncDeployments.indexOf('collection.create(')
    // A read before the two branches serves both, as project_id's does
    const before = syncDeployments.slice(0, updateAt)
    const branches = {
        update: before + syncDeployments.slice(updateAt, createAt),
        create: before + syncDeployments.slice(createAt),
    }

    // The keys of the CREATE payload, one per line of mapModelToPayload's object
    const serviceSource = read('DeploymentService.ts')
    const pushStart = serviceSource.indexOf('export function mapModelToPayload(')
    const pushBody = serviceSource.slice(pushStart, serviceSource.indexOf('\n}', pushStart))
    const pushed = Array.from(pushBody.matchAll(/^[ \t]+([a-z_]+):/gm), match => match[1])

    const modelSource = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'models', 'Deployment.ts'), 'utf8')

    const columns = Array.from(new Set([...Object.keys(schema.tables.deployments.columns), ...pushed]))
        .filter(name => name !== 'id' && !BOOKKEEPING.has(name) && !NO_FIELD.has(name))

    it('finds the function, its two branches, the push and the table', () => {
        expect(start).toBeGreaterThan(-1)
        expect(updateAt).toBeGreaterThan(-1)
        expect(createAt).toBeGreaterThan(updateAt)
        expect(pushed).toContain('lorawan_snr_at_start')
        expect(columns).toContain('camera_model')
    })

    it.each(columns)('copies %s in both branches', (column) => {
        // `(row as any).modified_by` counts: the generated row type lacks it
        const reads = new RegExp(`\\brow(?: as any\\))?\\.${column}\\b`)
        expect({ column, update: reads.test(branches.update), create: reads.test(branches.create) })
            .toEqual({ column, update: true, create: true })
    })

    it.each(Array.from(NO_FIELD))('keeps no field for %s, so it needs no pull line', (column) => {
        expect(modelSource).not.toContain(`('${column}')`)
    })
})
