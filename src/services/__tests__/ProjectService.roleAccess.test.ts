/**
 * #351: the project list follows the backend's roles. A manager sees every
 * project of the organisation, with or without a role on it; ww_admin is
 * system scope; an organisation-scope project_admin, which the backend no
 * longer allows, grants nothing.
 */
import ProjectService from '../ProjectService'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../SupabaseSyncService', () => ({ __esModule: true, default: {} }))
jest.mock('../UserRoleService', () => ({ __esModule: true, default: {} }))
jest.mock('../InvitationService', () => ({ __esModule: true, default: {} }))
jest.mock('../OutboxService', () => ({ __esModule: true, default: {} }))
jest.mock('../auth', () => ({ getStoredUserId: jest.fn() }))

const ME = 'user-me'

const role = (role: string, scopeType: string, scopeId: string | null) => ({
	id: `${role}-${scopeId ?? 'system'}`, userId: ME, role, scopeType, scopeId, isActive: true,
})

const project = (id: string, organisationId: string, createdBy = 'someone-else') => ({
	id, name: id, organisationId, createdBy, isActive: true,
})

const ids = (projects: Array<{ id: string }>) => projects.map(p => p.id).sort()

beforeEach(() => {
	resetFakeDatabase()
	// The list's counts and members are not what this tests
	jest.spyOn(ProjectService as any, 'enrichProjectWithDetails').mockImplementation(async (p: any) => p)
	seedRows('projects', [
		project('general-1', 'org-general'),
		project('general-2', 'org-general'),
		project('other-1', 'org-other'),
	])
})

describe('ProjectService.getProjectsForUser', () => {
	it('shows an organisation manager every project of the organisation', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-general')])

		expect(ids(await ProjectService.getProjectsForUser(ME))).toEqual(['general-1', 'general-2'])
	})

	it('shows a ww_admin at system scope every project', async () => {
		seedRows('user_roles', [role('ww_admin', 'system', null)])

		expect(ids(await ProjectService.getProjectsForUser(ME))).toEqual(['general-1', 'general-2', 'other-1'])
	})

	it('shows a project role its own project only, and an organisation-scope project_admin nothing', async () => {
		seedRows('user_roles', [
			role('project_member', 'project', 'other-1'),
			role('project_admin', 'organisation', 'org-general'),
		])

		expect(ids(await ProjectService.getProjectsForUser(ME))).toEqual(['other-1'])
	})
})

describe('ProjectService.getProjectsForUserInOrganisation', () => {
	it('gives a manager the whole organisation', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-general')])

		expect(ids(await ProjectService.getProjectsForUserInOrganisation(ME, 'org-general'))).toEqual(['general-1', 'general-2'])
	})

	it('gives an organisation member only the projects they hold a role on', async () => {
		seedRows('user_roles', [
			role('organisation_member', 'organisation', 'org-general'),
			role('project_viewer', 'project', 'general-2'),
		])

		expect(ids(await ProjectService.getProjectsForUserInOrganisation(ME, 'org-general'))).toEqual(['general-2'])
	})
})
