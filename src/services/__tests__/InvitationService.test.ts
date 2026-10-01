import InvitationService from '../InvitationService'

const mockRpc = jest.fn()
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		rpc: mockRpc,
		auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
	}),
}))

describe('InvitationService.sendInvitation', () => {
	beforeEach(() => {
		mockRpc.mockReset().mockResolvedValue({ data: 'invitation-id', error: null })
	})

	// #308: the invitee's side matches the address exactly against their
	// lower-case JWT email, so a mixed-case invitation would never be found
	it('sends the address trimmed and in lower case', async () => {
		await InvitationService.sendInvitation('project-1', '  Tama@WW.org ', 'project_member')

		expect(mockRpc).toHaveBeenCalledWith('send_project_invitation', {
			p_project_id: 'project-1',
			p_invitee_email: 'tama@ww.org',
			p_role: 'project_member',
		})
	})

	it('passes a refusal on to the caller', async () => {
		mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_unique_pending_invitation"' } })

		await expect(InvitationService.sendInvitation('project-1', 'tama@ww.org')).rejects.toMatchObject({ code: '23505' })
	})
})
