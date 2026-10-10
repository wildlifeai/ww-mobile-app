import SupabaseSyncService from '../SupabaseSyncService'
import { getSupabaseClient } from '../supabase'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../utils/networkErrors', () => ({ logCloudFailure: jest.fn() }))
jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../SyncStateService', () => ({
	__esModule: true,
	default: { get: jest.fn(async () => null), set: jest.fn(async () => {}) },
	SYNC_STATE_KEYS: {
		PROJECTS_LAST_PULLED_AT: 'projects_last_pulled_at',
		DEVICES_LAST_PULLED_AT: 'devices_last_pulled_at',
		DEPLOYMENTS_LAST_PULLED_AT: 'deployments_last_pulled_at',
	},
}))

/**
 * #349: on 1 October 2026 the deployments pull wrote the server's row over a
 * deployment whose site-photo change was still in the outbox, putting the
 * local photo path back, and the next upload dropped the photo (#347). A
 * record with a change not yet pushed keeps its local copy in every pull.
 */
describe('incremental pulls keep a record with a change waiting in the outbox', () => {
	let serverRows: any[] = []

	beforeEach(() => {
		resetFakeDatabase()
		;(getSupabaseClient as jest.Mock).mockImplementation(() => ({
			auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
			from: jest.fn(() => ({
				select: jest.fn(() => ({ gt: jest.fn(async () => ({ data: serverRows, error: null })) })),
			})),
		}))
	})

	const waiting = (table: string, recordId: string, status = 'pending') =>
		seedRows('sync_outbox', [{ id: `op-${recordId}`, tableName: table, recordId, status, operationType: 'UPDATE' }])

	const deploymentRow = (id: string, photos: string[]) => ({
		id,
		project_id: 'project-1',
		device_id: 'device-1',
		name: 'Site',
		camera_location_image_paths: photos,
		created_at: '2026-10-01T00:00:00Z',
		updated_at: '2026-10-01T00:00:00Z',
		deleted_at: null,
	})

	it('keeps a deployment whose photo change has not been pushed, and applies the others', async () => {
		seedRows('deployments', [
			{ id: 'dep-waiting', name: 'Site', cameraLocationImagePaths: ['deployments/dep-waiting/site.jpg'] },
			{ id: 'dep-synced', name: 'Old name' },
		])
		waiting('deployments', 'dep-waiting')
		serverRows = [
			deploymentRow('dep-waiting', ['file:///data/user/0/app/photo.jpg']),
			{ ...deploymentRow('dep-synced', []), name: 'New name' },
		]

		await (SupabaseSyncService as any).syncDeployments()

		const byId = Object.fromEntries(rowsIn('deployments').map((d) => [d.id, d]))
		expect(byId['dep-waiting'].cameraLocationImagePaths).toEqual(['deployments/dep-waiting/site.jpg'])
		expect(byId['dep-synced'].name).toBe('New name')
	})

	// A refused change (#449) is never pushed, so the server's row is the one that stands
	it('keeps it too while the change is failed or being sent, not once it is synced or refused', async () => {
		seedRows('deployments', [
			{ id: 'dep-failed', name: 'Local' },
			{ id: 'dep-sending', name: 'Local' },
			{ id: 'dep-done', name: 'Local' },
			{ id: 'dep-refused', name: 'Local' },
		])
		waiting('deployments', 'dep-failed', 'failed')
		waiting('deployments', 'dep-sending', 'syncing')
		waiting('deployments', 'dep-done', 'synced')
		waiting('deployments', 'dep-refused', 'refused')
		serverRows = ['dep-failed', 'dep-sending', 'dep-done', 'dep-refused'].map((id) => ({ ...deploymentRow(id, []), name: 'Server' }))

		await (SupabaseSyncService as any).syncDeployments()

		const names = Object.fromEntries(rowsIn('deployments').map((d) => [d.id, d.name]))
		expect(names).toEqual({ 'dep-failed': 'Local', 'dep-sending': 'Local', 'dep-done': 'Server', 'dep-refused': 'Server' })
	})

	it('applies the same rule to projects and devices', async () => {
		seedRows('projects', [{ id: 'project-1', name: 'Local project' }])
		seedRows('devices', [{ id: 'device-1', name: 'Local device' }])
		waiting('projects', 'project-1')
		waiting('devices', 'device-1')

		serverRows = [{ id: 'project-1', name: 'Server project', organisation_id: 'org-1', updated_at: '2026-10-01T00:00:00Z', deleted_at: null }]
		await (SupabaseSyncService as any).syncProjects()
		serverRows = [{ id: 'device-1', name: 'Server device', bluetooth_id: 'AA', organisation_id: 'org-1', updated_at: '2026-10-01T00:00:00Z' }]
		await (SupabaseSyncService as any).syncDevices()

		expect(rowsIn('projects')[0].name).toBe('Local project')
		expect(rowsIn('devices')[0].name).toBe('Local device')
	})
})
