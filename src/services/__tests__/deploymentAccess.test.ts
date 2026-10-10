/**
 * #450: Start Monitoring and End Deployment ask the phone's own roles whether
 * this account may do it, before anything is written to the camera, and say
 * why not and who can. The rules are roleAccess.ts's, from ww-backend's
 * deployments policies.
 */
import { endRefusal, mayChangeDeployment, projectsToDeployInto, startRefusal } from '../deploymentAccess'
import { getSupabaseClient } from '../supabase'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
// The Supabase client is the global mock (tests/setup/sanitySetup.ts): nothing
// here may call it, since these checks run in the field

const ME = 'user-me'
const TUI = 'user-tui'

const role = (name: string, scopeType: string, scopeId: string | null, userId = ME) => ({
	id: `${userId}-${name}-${scopeId ?? 'system'}`, userId, role: name, scopeType, scopeId, isActive: true,
})

const mine = { projectId: 'p-1', setupBy: ME }
const tuis = { projectId: 'p-1', setupBy: TUI }

beforeEach(() => {
	resetFakeDatabase()
	seedRows('projects', [{ id: 'p-1', name: 'Sinbad Gully' }, { id: 'p-2', name: 'Orokonui' }])
	seedRows('users', [{ id: TUI, firstname: 'Tui Smith', surname: '' }])
})

describe('startRefusal', () => {
	it('stops a viewer, naming the project and what to ask for', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1')])

		expect(await startRefusal(ME, 'p-1')).toBe(
			'You are a viewer in "Sinbad Gully", and viewers cannot start monitoring. Ask a project admin to make you a member.'
		)
	})

	it('lets a member, a project admin or a ww_admin start', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1'), role('project_admin', 'project', 'p-2')])
		expect(await startRefusal(ME, 'p-1')).toBeNull()
		expect(await startRefusal(ME, 'p-2')).toBeNull()

		resetFakeDatabase()
		seedRows('user_roles', [role('ww_admin', 'system', null)])
		expect(await startRefusal(ME, 'p-1')).toBeNull()
	})

	it('stops an organisation manager with no role in the project, as the server does', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-1')])

		expect(await startRefusal(ME, 'p-1')).toBe(
			'You are not a member of "Sinbad Gully", so you cannot start monitoring in it. Ask a project admin to add you as a member.'
		)
	})

	it("counts another person's role from the member cache for nothing", async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1'), role('project_admin', 'project', 'p-1', TUI)])

		expect(await startRefusal(ME, 'p-1')).toMatch(/^You are a viewer in "Sinbad Gully"/)
	})

	it('stops when no roles have reached the phone, and says to sync', async () => {
		expect(await startRefusal(ME, 'p-1')).toBe(
			'Your roles have not reached this phone yet, so it cannot tell whether you may start monitoring. Connect so the app can sync, then try again.'
		)
	})

	it('answers offline, from the roles on the phone alone', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1'), role('project_viewer', 'project', 'p-2')])

		expect(await startRefusal(ME, 'p-1')).toBeNull()
		expect(await startRefusal(ME, 'p-2')).not.toBeNull()
		expect(getSupabaseClient).not.toHaveBeenCalled()
	})
})

describe('projectsToDeployInto', () => {
	it('keeps only the projects this account may deploy into', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1'), role('project_member', 'project', 'p-2')])

		expect(await projectsToDeployInto(ME, [{ id: 'p-1' }, { id: 'p-2' }])).toEqual([{ id: 'p-2' }])
	})
})

describe('endRefusal', () => {
	it('lets the creator end their own while a member', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1')])

		expect(await endRefusal(ME, mine)).toBeNull()
	})

	it('stops the creator once made a viewer, and says who can', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1')])

		expect(await endRefusal(ME, mine)).toBe(
			'You started this deployment, but you are now a viewer in "Sinbad Gully", and viewers cannot end deployments. A project admin can end it, or make you a member again.'
		)
	})

	it('stops a viewer, naming who started it', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1')])

		expect(await endRefusal(ME, tuis)).toBe(
			'You are a viewer in "Sinbad Gully", and viewers cannot end deployments. Only Tui Smith, who started it, or a project admin can end it.'
		)
	})

	it("stops a member ending someone else's, as the server does", async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1')])

		expect(await endRefusal(ME, tuis)).toBe(
			'Members can end only the deployments they started. Only Tui Smith, who started it, or a project admin can end it.'
		)
	})

	it('says "the person who started it" when the phone does not know their name', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1')])

		expect(await endRefusal(ME, { projectId: 'p-1', setupBy: 'user-unknown' })).toBe(
			'Members can end only the deployments they started. Only the person who started it or a project admin can end it.'
		)
	})

	it("lets a project admin or a ww_admin end anyone's", async () => {
		seedRows('user_roles', [role('project_admin', 'project', 'p-1')])
		expect(await endRefusal(ME, tuis)).toBeNull()

		resetFakeDatabase()
		seedRows('user_roles', [role('ww_admin', 'system', null)])
		expect(await endRefusal(ME, tuis)).toBeNull()
	})

	it('stops an organisation manager, as the server does', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-1')])

		expect(await endRefusal(ME, tuis)).toBe(
			'You are not a member of "Sinbad Gully". Only Tui Smith, who started it, or a project admin can end it.'
		)
	})

	it('stops when no roles have reached the phone, and says to sync', async () => {
		expect(await endRefusal(ME, mine)).toBe(
			'Your roles have not reached this phone yet, so it cannot tell whether you may end this deployment. Connect so the app can sync, then try again.'
		)
	})

	it('answers offline, from the roles on the phone alone', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1')])

		expect(await endRefusal(ME, mine)).toBeNull()
		expect(await endRefusal(ME, tuis)).not.toBeNull()
		expect(getSupabaseClient).not.toHaveBeenCalled()
	})
})

// #467: the photo upload asks this before it touches storage
describe('mayChangeDeployment', () => {
	it('answers as endRefusal does, without the wording', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'p-1'), role('project_admin', 'project', 'p-2')])

		expect(await mayChangeDeployment(ME, mine)).toBe(true)
		expect(await mayChangeDeployment(ME, tuis)).toBe(false)
		expect(await mayChangeDeployment(ME, { projectId: 'p-2', setupBy: TUI })).toBe(true)
		expect(await mayChangeDeployment(null, mine)).toBe(false)
	})

	it('says no to a viewer, and with no roles on the phone', async () => {
		expect(await mayChangeDeployment(ME, mine)).toBe(false)
		seedRows('user_roles', [role('project_viewer', 'project', 'p-1')])
		expect(await mayChangeDeployment(ME, mine)).toBe(false)
	})
})
