import { managedOrganisationIds, projectRoleIds, seesEverything, seesOrganisation } from '../roleAccess'

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
