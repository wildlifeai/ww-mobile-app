/**
 * Whether this account may start or end a deployment, asked of the phone's own
 * copy of its roles so the answer is there offline (#450), and what to tell the
 * operator when it may not. The rules are in roleAccess.ts, from ww-backend's
 * policies; row level security still enforces them. Asking first means a
 * viewer is stopped before anything is written to the camera, instead of the
 * server refusing the change at the next sync while the phone shows it done.
 *
 * With no roles on the phone at all, nothing synced yet, the answer is no. A
 * start the server then refuses leaves the camera recording under a deployment
 * id the server never gets, and an end it refuses leaves the phone showing the
 * deployment ended while the server and the website show it running.
 */

import { Q } from '@nozbe/watermelondb'
import database from '../database'
import UserRole from '../database/models/UserRole'
import Project from '../database/models/Project'
import User from '../database/models/User'
import { mayCreateDeployment, mayUpdateDeployment, mayUpdateProject, projectRoleIn } from './roleAccess'

export const START_REFUSED_TITLE = 'Cannot Start Monitoring'
export const END_REFUSED_TITLE = 'Cannot End This Deployment'

/** On the Dev Deployment Test, for an account that may deploy but not change the project (#466) */
export const SETTINGS_FOR_THIS_TEST_ONLY = 'These settings apply to this test only. Only a project admin can change the project\'s settings.'

const ROLES_NOT_ON_PHONE = 'Your roles have not reached this phone yet, so it cannot tell whether you may'
const SYNC_THEN_RETRY = 'Connect so the app can sync, then try again.'

/** This account's live roles. The member cache keeps other people's in the same table */
const ownRoles = async (userId: string | null | undefined): Promise<UserRole[]> => {
	if (!userId) return []
	return database.get<UserRole>('user_roles')
		.query(Q.where('user_id', userId), Q.where('is_active', true))
		.fetch()
}

/** The project's name in quotes, as the other deployment messages give it */
const projectLabel = async (projectId: string): Promise<string> => {
	try {
		const project = await database.get<Project>('projects').find(projectId)
		if (project.name) return `"${project.name}"`
	} catch {
		// Not on the phone
	}
	return 'this project'
}

/** A name from the phone's users table, the account's own or the member cache's, or null */
const personName = async (userId: string): Promise<string | null> => {
	try {
		const user = await database.get<User>('users').find(userId)
		return `${user.firstname || ''} ${user.surname || ''}`.trim() || null
	} catch {
		return null
	}
}

/** Whether this account may save settings to the project, which only a project admin may change (#466) */
export async function maySaveProjectSettings(userId: string | null | undefined, projectId: string): Promise<boolean> {
	return mayUpdateProject(await ownRoles(userId), projectId)
}

/** The projects of the list this account may start a deployment in */
export async function projectsToDeployInto<T extends { id: string }>(userId: string, projects: T[]): Promise<T[]> {
	const roles = await ownRoles(userId)
	return projects.filter(p => mayCreateDeployment(roles, p.id))
}

/** Why this account may not start a deployment in the project, or null when it may */
export async function startRefusal(userId: string | null | undefined, projectId: string): Promise<string | null> {
	const roles = await ownRoles(userId)
	if (mayCreateDeployment(roles, projectId)) return null
	if (roles.length === 0) return `${ROLES_NOT_ON_PHONE} start monitoring. ${SYNC_THEN_RETRY}`

	const project = await projectLabel(projectId)
	return projectRoleIn(roles, projectId) === 'project_viewer'
		? `You are a viewer in ${project}, and viewers cannot start monitoring. Ask a project admin to make you a member.`
		: `You are not a member of ${project}, so you cannot start monitoring in it. Ask a project admin to add you as a member.`
}

/** Why this account may not end the deployment, naming who can, or null when it may */
export async function endRefusal(
	userId: string | null | undefined,
	deployment: { projectId: string; setupBy?: string | null },
): Promise<string | null> {
	const roles = await ownRoles(userId)
	if (userId && mayUpdateDeployment(roles, deployment, userId)) return null
	if (roles.length === 0) return `${ROLES_NOT_ON_PHONE} end this deployment. ${SYNC_THEN_RETRY}`

	const project = await projectLabel(deployment.projectId)
	const role = projectRoleIn(roles, deployment.projectId)
	if (deployment.setupBy === userId) {
		return role === 'project_viewer'
			? `You started this deployment, but you are now a viewer in ${project}, and viewers cannot end deployments. A project admin can end it, or make you a member again.`
			: `You started this deployment, but you are no longer a member of ${project}. A project admin can end it.`
	}

	// The creator can end it only while a member, which this phone cannot see
	// for anyone else, so they are named as one who can
	const starter = deployment.setupBy ? await personName(deployment.setupBy) : null
	const who = !deployment.setupBy
		? 'a project admin'
		: starter ? `${starter}, who started it, or a project admin` : 'the person who started it or a project admin'
	const why = role === 'project_member'
		? 'Members can end only the deployments they started.'
		: role === 'project_viewer'
			? `You are a viewer in ${project}, and viewers cannot end deployments.`
			: `You are not a member of ${project}.`
	return `${why} Only ${who} can end it.`
}
