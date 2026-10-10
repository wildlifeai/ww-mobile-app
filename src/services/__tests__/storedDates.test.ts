/**
 * Dates kept on the phone (#425). WatermelonDB's @date writes epoch
 * milliseconds, and a value is fitted to its column's type: until schema 407
 * user_roles.granted_at and expires_at and deployments.lorawan_last_verified_at
 * were 'string' columns, so the number was kept as null, or '' for the required
 * granted_at, and read back as null. Every pulled role lost its dates, the
 * member list showed each member as granted the moment it was read, and an
 * expiry never reached the phone.
 *
 * These run against a real WatermelonDB, in memory through LokiJS with the
 * generated schema. The fake database keeps whatever it is given, so it
 * cannot show this.
 */
import { Q } from '@nozbe/watermelondb'

import database from '../../database'
import type Deployment from '../../database/models/Deployment'
import type SyncOutbox from '../../database/models/SyncOutbox'
import type UserRole from '../../database/models/UserRole'
import SupabaseSyncService from '../SupabaseSyncService'
import { DeploymentService } from '../DeploymentService'
import ProjectService from '../ProjectService'
import { getProjectMembers } from '../UserRoleService'

jest.mock('../../database', () => {
	const { Database } = require('@nozbe/watermelondb')
	const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
	require('@nozbe/watermelondb/utils/common/logger').default.silence()
	const model = (name: string) => require(`../../database/models/${name}`).default
	return {
		__esModule: true,
		default: new Database({
			adapter: new LokiJSAdapter({
				schema: require('../../database/schema').default,
				useWebWorker: false,
				useIncrementalIndexedDB: false,
				// Loki saves every 500 ms by default, which keeps Jest from exiting
				extraLokiOptions: { autosave: false },
			}),
			modelClasses: ['Deployment', 'Device', 'Project', 'ProjectInvitation', 'SyncOutbox', 'User', 'UserRole'].map(model),
		}),
	}
})
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../utils/networkErrors', () => ({ logCloudFailure: jest.fn(), isNetworkOrRetryable: jest.fn(() => true) }))

const ME = 'user-me'
const TAMA = 'user-tama'
const PROJECT = 'project-1'

// What the server holds, and whether it can be reached
const mockServer = { online: true, roles: [] as any[], users: [] as any[], members: [] as any[] }
const mockUnreachable = { data: null, error: { message: 'TypeError: Network request failed', code: '' } }

jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		rpc: async () => (mockServer.online ? { data: mockServer.members, error: null } : mockUnreachable),
		from: (table: string) => {
			const chain: any = {
				select: () => chain,
				eq: () => chain,
				is: () => chain,
				in: () => chain,
				then: (resolve: any, reject: any) => Promise.resolve(
					!mockServer.online ? mockUnreachable
						: table === 'user_roles' ? { data: mockServer.roles.map((row) => ({ ...row })), error: null }
							: table === 'users' ? { data: mockServer.users, error: null }
								: { data: [], error: null },
				).then(resolve, reject),
			}
			return chain
		},
	}),
}))

const serverRole = (fields: Record<string, any>) => ({
	id: 'my-role',
	user_id: ME,
	role: 'project_admin',
	scope_type: 'project',
	scope_id: PROJECT,
	granted_by: ME,
	granted_at: '2026-08-01T02:30:00Z',
	expires_at: null,
	is_active: true,
	modified_by: ME,
	created_at: '2026-08-01T02:30:00Z',
	updated_at: '2026-08-01T02:30:00Z',
	deleted_at: null,
	...fields,
})

const pullRoles = () => (SupabaseSyncService as any).syncUserRoles(ME)
const storedRole = (id: string) => database.get<UserRole>('user_roles').find(id)
const iso = (value: string) => new Date(value).toISOString()

beforeEach(async () => {
	await database.write(() => database.unsafeResetDatabase())
	mockServer.online = true
	mockServer.roles = []
	mockServer.users = [{ id: ME, firstname: 'Victor', surname: 'Anton', modified_by: ME }]
	mockServer.members = []
})

describe('a role pulled from the server', () => {
	it('keeps granted_at and expires_at on the phone', async () => {
		mockServer.roles = [serverRole({ expires_at: '2026-12-31T11:00:00Z' })]

		await pullRoles()

		const role = await storedRole('my-role')
		expect(role.grantedAt?.toISOString()).toBe(iso('2026-08-01T02:30:00Z'))
		expect(role.expiresAt?.toISOString()).toBe(iso('2026-12-31T11:00:00Z'))
	})

	it('reads no expiry when the server has none', async () => {
		mockServer.roles = [serverRole({})]

		await pullRoles()

		expect((await storedRole('my-role')).expiresAt).toBeNull()
	})

	it('learns an expiry set after it was first pulled', async () => {
		mockServer.roles = [serverRole({})]
		await pullRoles()

		mockServer.roles = [serverRole({ expires_at: '2026-11-30T11:00:00Z', updated_at: '2026-10-10T00:00:00Z' })]
		await pullRoles()

		expect((await storedRole('my-role')).expiresAt?.toISOString()).toBe(iso('2026-11-30T11:00:00Z'))
	})
})

describe('the member list read from the phone', () => {
	it('says when each role was granted, not when the list was read', async () => {
		// My role from the sync, Tama's from the member cache (#307)
		mockServer.roles = [serverRole({})]
		await pullRoles()
		mockServer.members = [
			{ id: ME, name: 'Victor Anton', email: 'victor@ww.org', role: 'project_admin', granted_at: '2026-08-01T02:30:00Z', granted_by: ME },
			{ id: TAMA, name: 'Tama Te Rangi', email: 'tama@ww.org', role: 'project_member', granted_at: '2026-09-01T00:00:00Z', granted_by: ME },
		]
		await getProjectMembers(PROJECT, ME)

		mockServer.online = false
		const members = await getProjectMembers(PROJECT, ME)

		const grantedAt = Object.fromEntries(members.map((m) => [m.id, m.granted_at]))
		expect(grantedAt).toEqual({
			[ME]: iso('2026-08-01T02:30:00Z'),
			[TAMA]: iso('2026-09-01T00:00:00Z'),
		})
	})
})

describe('a deployment\'s lorawan_last_verified_at', () => {
	it('reads back, and goes up as an ISO string', async () => {
		jest.spyOn(ProjectService, 'getProjectById').mockResolvedValue(null)
		jest.spyOn(SupabaseSyncService, 'requestSync').mockImplementation(() => {})
		const verifiedAt = new Date('2026-10-09T21:30:00Z')

		const created = await DeploymentService.createDeployment({
			name: 'Ridge',
			projectId: PROJECT,
			deviceId: 'device-1',
			setupBy: ME,
			locationName: 'Ridge track',
			lorawanLastVerifiedAt: verifiedAt,
		})

		const stored = await database.get<Deployment>('deployments').find(created.id)
		expect(stored.lorawanLastVerifiedAt?.getTime()).toBe(verifiedAt.getTime())
		const [queued] = await database.get<SyncOutbox>('sync_outbox')
			.query(Q.where('table_name', 'deployments'))
			.fetch()
		expect(JSON.parse(queued.payload).lorawan_last_verified_at).toBe('2026-10-09T21:30:00.000Z')
	})
})
