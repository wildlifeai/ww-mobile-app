import {
	managedOrganisationIds, mayCreateDeployment, mayUpdateDeployment, mayUpdateProject, projectRoleIds, projectRoleIn,
	seesEverything, seesOrganisation,
} from '../roleAccess'

// #351: the backend's role rules (ww-backend tables/14_user_roles.sql)
const role = (role: string, scopeType: string, scopeId: string | null = null) => ({ role, scopeType, scopeId })

describe('roleAccess', () => {
	it('lets a ww_admin, or a manager at system scope, see everything', () => {
		expect(seesEverything([role('ww_admin', 'system')])).toBe(true)
		expect(seesEverything([role('organisation_manager', 'system')])).toBe(true)
	})

	it('no longer reads a global scope or an organisation-scope admin as everything', () => {
		expect(seesEverything([role('ww_admin', 'global')])).toBe(false)
		expect(seesEverything([role('project_admin', 'organisation', 'org-1')])).toBe(false)
	})

	it('gives an organisation manager every project of that organisation, and only it', () => {
		const roles = [role('organisation_manager', 'organisation', 'org-1'), role('organisation_member', 'organisation', 'org-2')]

		expect([...managedOrganisationIds(roles)]).toEqual(['org-1'])
		expect(seesOrganisation(roles, 'org-1')).toBe(true)
		expect(seesOrganisation(roles, 'org-2')).toBe(false)
	})

	it('gives a project role its own project and nothing more', () => {
		const roles = [
			role('project_admin', 'project', 'p-1'),
			role('project_viewer', 'project', 'p-2'),
			role('project_admin', 'organisation', 'org-1'),
		]

		expect([...projectRoleIds(roles)].sort()).toEqual(['p-1', 'p-2'])
		expect(seesOrganisation(roles, 'org-1')).toBe(false)
	})
})

// #450: ww-backend yyy_policies/52_deployments.sql, through has_project_role
// (functions/29_has_project_role.sql) and can_delete_deployment
describe('roleAccess, deployments', () => {
	const NOW = Date.parse('2026-10-10T00:00:00Z')
	const mine = { projectId: 'p-1', setupBy: 'me' }
	const theirs = { projectId: 'p-1', setupBy: 'someone-else' }

	it('lets a member or an admin of the project start one, and not a viewer', () => {
		expect(mayCreateDeployment([role('project_member', 'project', 'p-1')], 'p-1', NOW)).toBe(true)
		expect(mayCreateDeployment([role('project_admin', 'project', 'p-1')], 'p-1', NOW)).toBe(true)
		expect(mayCreateDeployment([role('project_viewer', 'project', 'p-1')], 'p-1', NOW)).toBe(false)
	})

	it('lets a ww_admin start one anywhere', () => {
		expect(mayCreateDeployment([role('ww_admin', 'system')], 'p-1', NOW)).toBe(true)
	})

	it('gives an organisation manager or member nothing above viewer', () => {
		expect(mayCreateDeployment([role('organisation_manager', 'organisation', 'org-1')], 'p-1', NOW)).toBe(false)
		expect(mayCreateDeployment([role('organisation_manager', 'system')], 'p-1', NOW)).toBe(false)
		expect(mayCreateDeployment([role('organisation_member', 'organisation', 'org-1')], 'p-1', NOW)).toBe(false)
	})

	it('reads a role in another project as no role', () => {
		expect(mayCreateDeployment([role('project_admin', 'project', 'p-2')], 'p-1', NOW)).toBe(false)
		expect(projectRoleIn([role('project_admin', 'project', 'p-2')], 'p-1', NOW)).toBeNull()
	})

	it('counts an expired role for nothing, as the server does', () => {
		const expired = { ...role('project_member', 'project', 'p-1'), expiresAt: new Date(NOW - 1000) }
		const current = { ...role('project_member', 'project', 'p-1'), expiresAt: new Date(NOW + 1000) }

		expect(mayCreateDeployment([expired], 'p-1', NOW)).toBe(false)
		expect(mayCreateDeployment([current], 'p-1', NOW)).toBe(true)
		expect(mayCreateDeployment([{ ...role('ww_admin', 'system'), expiresAt: NOW - 1 }], 'p-1', NOW)).toBe(false)
	})

	it('takes the highest of two roles in one project', () => {
		const roles = [role('project_viewer', 'project', 'p-1'), role('project_member', 'project', 'p-1')]

		expect(projectRoleIn(roles, 'p-1', NOW)).toBe('project_member')
		expect(mayCreateDeployment(roles, 'p-1', NOW)).toBe(true)
	})

	it('lets the creator end their own while a member, and not once a viewer', () => {
		expect(mayUpdateDeployment([role('project_member', 'project', 'p-1')], mine, 'me', NOW)).toBe(true)
		expect(mayUpdateDeployment([role('project_viewer', 'project', 'p-1')], mine, 'me', NOW)).toBe(false)
		expect(mayUpdateDeployment([], mine, 'me', NOW)).toBe(false)
	})

	it("does not let a member end someone else's", () => {
		expect(mayUpdateDeployment([role('project_member', 'project', 'p-1')], theirs, 'me', NOW)).toBe(false)
		expect(mayUpdateDeployment([role('project_member', 'project', 'p-1')], { projectId: 'p-1', setupBy: null }, 'me', NOW)).toBe(false)
	})

	it("lets a project admin or a ww_admin end anyone's", () => {
		expect(mayUpdateDeployment([role('project_admin', 'project', 'p-1')], theirs, 'me', NOW)).toBe(true)
		expect(mayUpdateDeployment([role('ww_admin', 'system')], theirs, 'me', NOW)).toBe(true)
	})

	it('does not let an organisation manager end one', () => {
		expect(mayUpdateDeployment([role('organisation_manager', 'organisation', 'org-1')], theirs, 'me', NOW)).toBe(false)
		expect(mayUpdateDeployment([role('organisation_manager', 'organisation', 'org-1')], mine, 'me', NOW)).toBe(false)
	})
})

// ww-backend yyy_policies/50_projects.sql, the projects UPDATE policy (#466)
describe('roleAccess, project settings', () => {
	it('lets a project admin or a ww_admin change the project, and no one else', () => {
		expect(mayUpdateProject([role('project_admin', 'project', 'p-1')], 'p-1')).toBe(true)
		expect(mayUpdateProject([role('ww_admin', 'system')], 'p-1')).toBe(true)
		expect(mayUpdateProject([role('project_member', 'project', 'p-1')], 'p-1')).toBe(false)
		expect(mayUpdateProject([role('project_viewer', 'project', 'p-1')], 'p-1')).toBe(false)
		expect(mayUpdateProject([role('organisation_manager', 'organisation', 'org-1')], 'p-1')).toBe(false)
		expect(mayUpdateProject([role('project_admin', 'project', 'p-2')], 'p-1')).toBe(false)
		expect(mayUpdateProject([], 'p-1')).toBe(false)
	})
})
