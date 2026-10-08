/**
 * The role pull (#375). On 1 October 2026 a Pixel 7 on cloud dev held 40
 * user_roles rows: Tui's ww_admin three times, Tama's organisation_manager of
 * General twice and no organisation_member, Tui's project_member of Global
 * Testing Project twice beside her project_admin. The lookup asked for a
 * system role's scope as '' while the row stored NULL, and left out the role
 * name, so each full pull added a copy or gave one row two roles in turn.
 *
 * The fake server below answers as RLS does: this account's rows only, and
 * never a soft-deleted one (user_roles_select_policy).
 */
import SupabaseSyncService from '../SupabaseSyncService'
import SyncStateService from '../SyncStateService'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../utils/networkErrors', () => ({ logCloudFailure: jest.fn() }))
jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../SyncStateService', () => {
	const actual = jest.requireActual('../SyncStateService')
	const mockState = new Map<string, string>()
	return {
		__esModule: true,
		SYNC_STATE_KEYS: actual.SYNC_STATE_KEYS,
		PULL_WATERMARK_KEYS: actual.PULL_WATERMARK_KEYS,
		default: {
			state: mockState,
			get: jest.fn(async (key: string) => mockState.get(key) ?? null),
			set: jest.fn(async (key: string, value: string) => { mockState.set(key, value) }),
			delete: jest.fn(async (key: string) => { mockState.delete(key) }),
		},
	}
})

const TUI = 'user-tui'
const TAMA = 'user-tama'
const GENERAL = 'b0000000-0000-0000-0000-000000000001'
const GLOBAL = 'c0000000-0000-0000-0000-000000000099'

// What the fake server holds, and who it answers as
const mockServer = { signedIn: TUI, roles: [] as any[], readError: null as any }

jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		from: (table: string) => {
			const filters: ((row: any) => boolean)[] = []
			const run = () => {
				if (table !== 'user_roles') return { data: [], error: null }
				if (mockServer.readError) return { data: null, error: mockServer.readError }
				// user_roles_select_policy: own rows, and not soft-deleted
				const visible = mockServer.roles.filter((row) => row.user_id === mockServer.signedIn && !row.deleted_at)
				return { data: visible.filter((row) => filters.every((f) => f(row))).map((row) => ({ ...row })), error: null }
			}
			const chain: any = {
				select: () => chain,
				eq: (column: string, value: any) => { filters.push((row) => row[column] === value); return chain },
				is: (column: string, value: any) => { filters.push((row) => (row[column] ?? null) === value); return chain },
				in: (column: string, values: any[]) => { filters.push((row) => values.includes(row[column])); return chain },
				gt: (column: string, value: string) => {
					filters.push((row) => Date.parse(row[column]) > Date.parse(value))
					return chain
				},
				then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
			}
			return chain
		},
	}),
}))

const state = (SyncStateService as any).state as Map<string, string>
const service = SupabaseSyncService as any

const role = (fields: { id: string, user_id: string, role: string, scope_type: string, scope_id: string | null, updated_at?: string }) => ({
	granted_by: fields.user_id,
	granted_at: '2026-10-01T00:05:55Z',
	expires_at: null,
	is_active: true,
	modified_by: fields.user_id,
	created_at: '2026-10-01T00:05:55Z',
	updated_at: '2026-10-01T00:05:55Z',
	deleted_at: null,
	...fields,
})

/** The pull as the sync runs it, for whoever is signed in */
const pull = () => service.syncUserRoles(mockServer.signedIn)
/** A full pull: the watermarks gone, as after an account change or a reset */
const fullPull = () => {
	state.clear()
	return pull()
}

const rolesOf = (userId: string) => rowsIn('user_roles')
	.filter((r) => r.userId === userId)
	.map((r) => `${r.role} ${r.scopeType} ${r.scopeId ?? 'NULL'}`)
	.sort()

beforeEach(() => {
	resetFakeDatabase()
	state.clear()
	mockServer.signedIn = TUI
	mockServer.readError = null
	mockServer.roles = []
	// The profiles the pull fetches for its roles are already here
	seedRows('users', [{ id: TUI }, { id: TAMA }])
})

describe('the role pull (#375)', () => {
	it('adds no copy of a system role on a second full pull', async () => {
		mockServer.roles = [
			role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null }),
			role({ id: 'tui-global', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: GLOBAL }),
		]

		await fullPull()
		await fullPull()

		expect(rolesOf(TUI)).toEqual([
			`project_admin project ${GLOBAL}`,
			'ww_admin system NULL',
		])
	})

	it('stores each role under the server\'s id', async () => {
		mockServer.roles = [
			role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null }),
			role({ id: 'tui-general', user_id: TUI, role: 'organisation_member', scope_type: 'organisation', scope_id: GENERAL }),
		]

		await fullPull()

		expect(rowsIn('user_roles').map((r) => r.id).sort()).toEqual(['tui-admin', 'tui-general'])
	})

	it('matches on the role as well as the scope, so two roles in one scope stay two', async () => {
		// The dev seed before ww-backend #248: a manager of General was its member too
		mockServer.signedIn = TAMA
		mockServer.roles = [
			role({ id: 'tama-member', user_id: TAMA, role: 'organisation_member', scope_type: 'organisation', scope_id: GENERAL }),
			role({ id: 'tama-manager', user_id: TAMA, role: 'organisation_manager', scope_type: 'organisation', scope_id: GENERAL }),
		]

		await fullPull()
		await fullPull()

		expect(rolesOf(TAMA)).toEqual([
			`organisation_manager organisation ${GENERAL}`,
			`organisation_member organisation ${GENERAL}`,
		])
	})

	it('does not keep a role the server soft-deleted', async () => {
		mockServer.roles = [
			role({ id: 'tui-admin', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: GLOBAL }),
			role({ id: 'tui-member', user_id: TUI, role: 'project_member', scope_type: 'project', scope_id: GLOBAL }),
		]
		await fullPull()

		// ww-backend #248 keeps the highest role per scope and soft-deletes the rest
		mockServer.roles[1] = { ...mockServer.roles[1], deleted_at: '2026-10-01T06:30:00Z', updated_at: '2026-10-01T06:30:00Z' }
		await pull()

		expect(rolesOf(TUI)).toEqual([`project_admin project ${GLOBAL}`])
	})

	it('rewrites nothing when nothing changed, though it reads every role each sync', async () => {
		mockServer.roles = [
			role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null }),
			role({ id: 'tui-global', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: GLOBAL }),
		]
		await pull()
		const updates = rowsIn('user_roles').map((r) => jest.spyOn(r, 'prepareUpdate'))

		await pull()

		for (const update of updates) expect(update).not.toHaveBeenCalled()
		expect(rowsIn('user_roles')).toHaveLength(2)
	})

	it('changes a promoted role in place', async () => {
		mockServer.roles = [role({ id: 'tui-global', user_id: TUI, role: 'project_member', scope_type: 'project', scope_id: GLOBAL })]
		await fullPull()

		// Since #248 a promotion changes the role on the same row
		mockServer.roles = [{ ...mockServer.roles[0], role: 'project_admin', updated_at: '2026-10-02T00:00:00Z' }]
		await pull()

		expect(rowsIn('user_roles')).toEqual([expect.objectContaining({ id: 'tui-global', role: 'project_admin' })])
	})

	it('removes the copies an earlier pull left on the phone, at the next sync', async () => {
		// The Pixel 7 on 1 October: copies with local ids, from the same server rows
		seedRows('user_roles', [
			...['local-1', 'local-2', 'local-3'].map((id) => ({
				id, userId: TUI, role: 'ww_admin', scopeType: 'system', scopeId: null, isActive: true,
			})),
			{ id: 'local-4', userId: TUI, role: 'project_admin', scopeType: 'project', scopeId: GLOBAL, isActive: true },
			{ id: 'local-5', userId: TUI, role: 'project_member', scopeType: 'project', scopeId: GLOBAL, isActive: true },
			{ id: 'local-6', userId: TUI, role: 'project_member', scopeType: 'project', scopeId: GLOBAL, isActive: true },
		])
		mockServer.roles = [
			role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null }),
			role({ id: 'tui-global', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: GLOBAL }),
			role({ id: 'tui-member', user_id: TUI, role: 'project_member', scope_type: 'project', scope_id: GLOBAL,
				deleted_at: '2026-10-01T06:30:00Z', updated_at: '2026-10-01T06:30:00Z' } as any),
		]
		// The role watermark of a build before #375: nothing changed on the server since
		state.set('user_roles_last_pulled_at', String(Date.parse('2026-10-01T07:00:00Z')))

		await pull()

		expect(rolesOf(TUI)).toEqual([
			`project_admin project ${GLOBAL}`,
			'ww_admin system NULL',
		])
	})

	it('leaves other accounts\' rows to them: an earlier sign-in, and the member cache', async () => {
		seedRows('user_roles', [
			{ id: 'tama-1', userId: TAMA, role: 'organisation_manager', scopeType: 'organisation', scopeId: GENERAL, isActive: true },
			{ id: 'tama-2', userId: TAMA, role: 'project_member', scopeType: 'project', scopeId: GLOBAL, isActive: true },
		])
		mockServer.roles = [role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null })]

		await fullPull()

		expect(rowsIn('user_roles').filter((r) => r.userId === TAMA).map((r) => r.id).sort()).toEqual(['tama-1', 'tama-2'])
	})

	it('keeps the creator\'s role in a project whose CREATE has not reached the server', async () => {
		seedRows('user_roles', [
			{ id: 'provisional', userId: TUI, role: 'project_admin', scopeType: 'project', scopeId: 'made-offline', isActive: true },
		])
		seedRows('sync_outbox', [{
			id: 'create-made-offline', tableName: 'projects', recordId: 'made-offline', operationType: 'CREATE', status: 'failed', userId: TUI,
		}])
		mockServer.roles = [role({ id: 'tui-admin', user_id: TUI, role: 'ww_admin', scope_type: 'system', scope_id: null })]

		await fullPull()
		expect(rolesOf(TUI)).toContain('project_admin project made-offline')

		// Once the project is up, the server's row takes over the provisional one
		mockServer.roles.push(role({ id: 'tui-made-offline', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: 'made-offline' }))
		await fullPull()
		expect(rolesOf(TUI)).toEqual(['project_admin project made-offline', 'ww_admin system NULL'])
	})

	it('removes nothing when the server lists no roles at all', async () => {
		seedRows('user_roles', [
			{ id: 'tui-admin', userId: TUI, role: 'ww_admin', scopeType: 'system', scopeId: null, isActive: true },
		])

		await fullPull()

		expect(rolesOf(TUI)).toEqual(['ww_admin system NULL'])
	})

	it('changes nothing when the read fails', async () => {
		seedRows('user_roles', [
			{ id: 'tui-admin', userId: TUI, role: 'ww_admin', scopeType: 'system', scopeId: null, isActive: true },
		])
		mockServer.roles = [role({ id: 'tui-global', user_id: TUI, role: 'project_admin', scope_type: 'project', scope_id: GLOBAL })]
		mockServer.readError = { message: 'JWT expired', code: 'PGRST301' }

		await fullPull()

		expect(rowsIn('user_roles').map((r) => r.id)).toEqual(['tui-admin'])
	})
})
