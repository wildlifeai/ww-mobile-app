/**
 * What a user's synced roles let them see on this phone: projects, and the
 * devices and deployments that hang off them (#351). The rules are the
 * backend's (ww-backend `tables/14_user_roles.sql`):
 *
 * - `ww_admin` is system scope and sees every organisation.
 * - `organisation_manager` sees every project of its organisation, or of every
 *   organisation at system scope (ww-backend #162).
 * - `project_admin`, `project_member` and `project_viewer` are project scope
 *   only (ww-backend #240), so each covers its own project and nothing more.
 * - `organisation_member` gives no project by itself.
 *
 * The server already scopes what sync sends. The local rule still matters on a
 * shared phone: another account's unsynced rows stay in the database for it
 * (#267) and must not show to whoever is signed in now.
 */

type RoleRow = { role: string; scopeType: string; scopeId?: string | null }

/** Sees every organisation's projects, devices and deployments */
export const seesEverything = (roles: RoleRow[]): boolean =>
	roles.some(r => r.scopeType === 'system' && (r.role === 'ww_admin' || r.role === 'organisation_manager'))

/** The organisations whose every project the roles see, apart from system scope */
export const managedOrganisationIds = (roles: RoleRow[]): Set<string> =>
	new Set(
		roles
			.filter(r => r.scopeType === 'organisation' && r.role === 'organisation_manager' && !!r.scopeId)
			.map(r => r.scopeId as string),
	)

/** Sees every project of this organisation */
export const seesOrganisation = (roles: RoleRow[], organisationId: string): boolean =>
	seesEverything(roles) || managedOrganisationIds(roles).has(organisationId)

/** The projects the roles name one by one */
export const projectRoleIds = (roles: RoleRow[]): Set<string> =>
	new Set(roles.filter(r => r.scopeType === 'project' && !!r.scopeId).map(r => r.scopeId as string))
