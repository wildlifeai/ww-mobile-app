/**
 * Changing a member's role and removing a member go through the server's
 * RPCs (#335). Writing user_roles directly was refused by RLS, and the removal
 * reported success while the person kept full access.
 */
import { removeProjectMember, updateProjectMemberRole } from '../UserRoleService'

// Helpers of the NetInfo mock in tests/__mocks__ (mapped in jest.config.js), not part of
// the real module's types; require keeps the instance the service uses
const { __setNetworkState, __resetNetworkState } = require('@react-native-community/netinfo') as {
	__setNetworkState: (state: { isConnected: boolean }) => void
	__resetNetworkState: () => void
}

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

const mockRpc = jest.fn()
const mockFrom = jest.fn()
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

const ME = 'user-me'
const TAMA = 'user-tama'
const PROJECT = 'project-1'

const changeRole = () => updateProjectMemberRole({
	project_id: PROJECT, user_id: TAMA, new_role: 'project_admin', updated_by: ME,
})
const remove = () => removeProjectMember({ project_id: PROJECT, user_id: TAMA, removed_by: ME })

const answers = (data: unknown, error: unknown = null, status = error ? 400 : 200) =>
	mockRpc.mockResolvedValue({ data, error, status })

beforeEach(() => {
	mockRpc.mockReset()
	mockFrom.mockReset()
})

afterEach(() => {
	__resetNetworkState()
})

describe('online', () => {
	it('changes a role through update_project_member_role, never user_roles', async () => {
		answers({ success: true, user_id: TAMA, project_id: PROJECT, old_role: 'project_member', new_role: 'project_admin' })

		const result = await changeRole()

		expect(mockRpc).toHaveBeenCalledWith('update_project_member_role', {
			p_project_id: PROJECT, p_user_id: TAMA, p_new_role: 'project_admin', p_updated_by: ME,
		})
		expect(mockFrom).not.toHaveBeenCalled()
		expect(result).toMatchObject({ success: true, old_role: 'project_member', new_role: 'project_admin' })
	})

	it('removes a member through remove_project_member, never user_roles', async () => {
		answers({ success: true, user_id: TAMA, project_id: PROJECT, removed_role: 'project_member' })

		const result = await remove()

		expect(mockRpc).toHaveBeenCalledWith('remove_project_member', {
			p_project_id: PROJECT, p_user_id: TAMA, p_removed_by: ME,
		})
		expect(mockFrom).not.toHaveBeenCalled()
		expect(result).toMatchObject({ success: true, removed_role: 'project_member' })
	})

	// The #335 removal: no error and nothing changed must not read as success
	it.each([
		['no reply', null],
		['a reply without success', { removed_role: 'project_member' }],
		['success false', { success: false }],
	])('does not report success on %s', async (_label, reply) => {
		answers(reply)

		for (const result of [await remove(), await changeRole()]) {
			expect(result.success).toBe(false)
			expect(result.error).toMatch(/did not confirm/)
		}
	})

	it('does not report success when the call throws', async () => {
		mockRpc.mockRejectedValue(new Error('boom'))

		const result = await remove()

		expect(result).toMatchObject({ success: false, reason: 'unknown' })
		expect(result.error).toContain('boom')
	})
})

describe('refusals, as the RPCs raise them', () => {
	it.each([
		['42501', 'Unauthorized: Only project admins can remove members', 'not_allowed', /Only project admins/],
		['42501', 'Unauthorized: p_removed_by must be the calling user', 'wrong_account', /Sign out and in again/],
		['23514', 'Cannot remove the last project admin', 'last_admin', /at least one admin/],
		['22023', 'Cannot demote yourself as the last project admin', 'last_admin', /at least one admin/],
		['22023', 'User is not a member of this project', 'not_a_member', /no longer a member/],
		['22023', 'User already has this role', 'same_role', /already have this role/],
		['PGRST301', 'JWT expired', 'unknown', /JWT expired/],
	])('%s "%s" is %s', async (code, message, reason, words) => {
		answers(null, { code, message, details: null, hint: null })

		const result = await remove()

		expect(result).toMatchObject({ success: false, reason })
		expect(result.error).toMatch(words)
	})

	it('says the server could not be reached when the request never got an answer', async () => {
		answers(null, { code: '', message: 'TypeError: Network request failed', details: '', hint: '' }, 0)

		const result = await changeRole()

		expect(result).toMatchObject({ success: false, reason: 'unreachable' })
		expect(result.error).toMatch(/Could not reach the server/)
	})
})

describe('offline', () => {
	it('sends nothing and says a connection is needed', async () => {
		__setNetworkState({ isConnected: false })

		const role = await changeRole()
		const removal = await remove()

		expect(mockRpc).not.toHaveBeenCalled()
		expect(mockFrom).not.toHaveBeenCalled()
		expect(role).toMatchObject({ success: false, reason: 'offline' })
		expect(role.error).toMatch(/Changing a role needs a connection/)
		expect(removal).toMatchObject({ success: false, reason: 'offline' })
		expect(removal.error).toMatch(/Removing a member needs a connection/)
	})
})
