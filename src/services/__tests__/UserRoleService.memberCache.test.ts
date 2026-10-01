/**
 * The project member list offline (#307): the get_project_members answer is
 * kept in the local users and user_roles tables, and read back when the
 * phone cannot reach the server.
 */
import { getProjectMembers } from '../UserRoleService'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

const mockRpc = jest.fn()
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		rpc: mockRpc,
		// Every direct table read fails, as it does offline
		from: () => {
			const chain: any = {
				select: () => chain,
				eq: () => chain,
				in: () => chain,
				then: (resolve: any) => resolve({ data: null, error: { message: 'TypeError: Network request failed' } }),
			}
			return chain
		},
	}),
}))

const ME = 'user-me'
const PROJECT = 'project-1'

const member = (id: string, name: string | null, email: string, role: string) => ({
	id, name, email, role,
	granted_at: '2026-09-01T00:00:00Z',
	granted_by: ME,
	granted_by_name: 'Victor Anton',
})

const online = (rows: any[]) => mockRpc.mockResolvedValue({ data: rows, error: null })
const offline = () => mockRpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Network request failed', code: '' } })

const projectRoles = () => rowsIn('user_roles')
	.filter((r) => r.scopeId === PROJECT)
	.map((r) => `${r.userId}:${r.role}`)
	.sort()

beforeEach(() => {
	resetFakeDatabase()
	mockRpc.mockReset()
	// My own role, as the sync brings it
	seedRows('user_roles', [{
		id: 'my-role', userId: ME, role: 'project_admin', scopeType: 'project', scopeId: PROJECT,
		isActive: true, grantedBy: ME, grantedAt: new Date('2026-08-01T00:00:00Z'),
	}])
})

it('keeps the online answer so the list shows names and emails offline', async () => {
	online([
		member(ME, 'Victor Anton', 'victor@ww.org', 'project_admin'),
		member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member'),
		member('user-aroha', 'Aroha Smith', 'aroha@ww.org', 'project_admin'),
	])
	const onlineList = await getProjectMembers(PROJECT, ME)
	expect(onlineList).toHaveLength(3)

	offline()
	const offlineList = await getProjectMembers(PROJECT, ME)

	const byId = Object.fromEntries(offlineList.map((m) => [m.id, m]))
	expect(Object.keys(byId).sort()).toEqual(['user-aroha', 'user-me', 'user-tama'])
	expect(byId['user-tama'].name).toBe('Tama Te Rangi')
	expect(byId['user-tama'].email).toBe('tama@ww.org')
	expect(byId['user-tama'].role).toBe('project_member')
	expect(byId['user-aroha'].name).toBe('Aroha Smith')
	expect(byId['user-aroha'].role).toBe('project_admin')
})

it('leaves my own rows to the sync', async () => {
	online([
		member(ME, 'Victor Anton', 'victor@ww.org', 'project_admin'),
		member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member'),
	])

	await getProjectMembers(PROJECT, ME)

	expect(rowsIn('users').map((u) => u.id)).toEqual(['user-tama'])
	expect(projectRoles()).toEqual(['user-me:project_admin', 'user-tama:project_member'])
	expect(rowsIn('user_roles').find((r) => r.userId === ME)?.id).toBe('my-role')
})

it('follows removals and role changes the next time the list is seen online', async () => {
	online([
		member(ME, 'Victor Anton', 'victor@ww.org', 'project_admin'),
		member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member'),
		member('user-aroha', 'Aroha Smith', 'aroha@ww.org', 'project_admin'),
	])
	await getProjectMembers(PROJECT, ME)

	online([
		member(ME, 'Victor Anton', 'victor@ww.org', 'project_admin'),
		member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_admin'),
	])
	await getProjectMembers(PROJECT, ME)

	expect(projectRoles()).toEqual(['user-me:project_admin', 'user-tama:project_admin'])
})

it('does not overwrite a known name with an empty one', async () => {
	online([member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member')])
	await getProjectMembers(PROJECT, ME)

	// get_project_members returns a null name when either name part is null
	online([member('user-tama', null, 'tama@ww.org', 'project_member')])
	await getProjectMembers(PROJECT, ME)

	expect(rowsIn('users').find((u) => u.id === 'user-tama')?.firstname).toBe('Tama Te Rangi')
})

it('does not touch the cache when the server cannot be reached', async () => {
	online([member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member')])
	await getProjectMembers(PROJECT, ME)

	offline()
	await getProjectMembers(PROJECT, ME)

	expect(projectRoles()).toEqual(['user-me:project_admin', 'user-tama:project_member'])
})

// #362: the screens add "(You)", so a name carrying it showed "(You) (You)"
it('gives my own name plain, online and offline', async () => {
	online([
		member(ME, 'Victor Anton', 'victor@ww.org', 'project_admin'),
		member('user-tama', 'Tama Te Rangi', 'tama@ww.org', 'project_member'),
	])
	const onlineList = await getProjectMembers(PROJECT, ME)
	expect(onlineList.find((m) => m.id === ME)?.name).toBe('Victor Anton')

	offline()
	const offlineList = await getProjectMembers(PROJECT, ME)
	const mine = offlineList.find((m) => m.id === ME)
	expect(mine).toBeDefined()
	expect(mine?.name).not.toMatch(/\(You\)|^Me$/)
})
