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
 *
 * Below those, what the roles let a user do with a deployment (#450).
 */

type RoleRow = { role: string; scopeType: string; scopeId?: string | null; expiresAt?: Date | number | null }

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

/*
 * What the roles let a user do with deployments (#450), so the app can say no
 * before the server does. The rules are ww-backend's, and RLS still enforces
 * them:
 *
 * - Creating one needs `has_project_role(project, 'project_member')`
 *   (`yyy_policies/52_deployments.sql`, INSERT), which `project_member`,
 *   `project_admin` and a system `ww_admin` pass. A `project_viewer` does not,
 *   and an `organisation_manager` passes nothing above viewer
 *   (`functions/29_has_project_role.sql`, ww-backend #162).
 * - Ending or changing one is an UPDATE: its creator while they hold
 *   `project_member`, or `project_admin`, which a `ww_admin` passes too. So a
 *   member cannot end someone else's deployment. A delete has the same rule
 *   (`can_delete_deployment`, `functions/23_soft_delete_deployment.sql`).
 * - A role past its `expires_at` counts for nothing, as on the server.
 *
 * `roles` must be the user's own rows: the member cache keeps other people's
 * roles in the same table (UserRoleService.fetchMembersFromCloud).
 */

const PROJECT_ROLE_RANK = ['project_viewer', 'project_member', 'project_admin']

const live = (roles: RoleRow[], now: number): RoleRow[] =>
	roles.filter(r => r.expiresAt === null || r.expiresAt === undefined || Number(r.expiresAt) > now)

const isWwAdmin = (roles: RoleRow[]): boolean =>
	roles.some(r => r.scopeType === 'system' && r.role === 'ww_admin')

/** The highest role the roles give in this project itself, or null. A ww_admin or a manager holds none */
export const projectRoleIn = (roles: RoleRow[], projectId: string, now = Date.now()): string | null =>
	live(roles, now)
		.filter(r => r.scopeType === 'project' && r.scopeId === projectId && PROJECT_ROLE_RANK.includes(r.role))
		.reduce<string | null>((best, r) => (
			best === null || PROJECT_ROLE_RANK.indexOf(r.role) > PROJECT_ROLE_RANK.indexOf(best) ? r.role : best
		), null)

/** May start a deployment in this project */
export const mayCreateDeployment = (roles: RoleRow[], projectId: string, now = Date.now()): boolean => {
	const role = projectRoleIn(roles, projectId, now)
	return isWwAdmin(live(roles, now)) || role === 'project_member' || role === 'project_admin'
}

/** May end or change this deployment */
export const mayUpdateDeployment = (
	roles: RoleRow[],
	deployment: { projectId: string; setupBy?: string | null },
	userId: string,
	now = Date.now(),
): boolean => {
	if (isWwAdmin(live(roles, now)) || projectRoleIn(roles, deployment.projectId, now) === 'project_admin') return true
	return !!deployment.setupBy && deployment.setupBy === userId && mayCreateDeployment(roles, deployment.projectId, now)
}

/**
 * May change the project's own settings, a `projects` UPDATE: `project_admin`
 * in the project, or a `ww_admin` (`yyy_policies/50_projects.sql`). A member
 * may deploy with other settings but not save them to the project (#466).
 */
export const mayUpdateProject = (roles: RoleRow[], projectId: string, now = Date.now()): boolean =>
	isWwAdmin(live(roles, now)) || projectRoleIn(roles, projectId, now) === 'project_admin'
