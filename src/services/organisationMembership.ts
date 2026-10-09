/**
 * Which organisations a user belongs to, with what role, and which one is current.
 *
 * `fetchUserOrganisations` in auth.ts asks the cloud first. When the cloud cannot
 * be reached, the answer is built here from the local database instead (#332).
 * Until then an offline start returned no organisations at all, so the Projects
 * tab, which needs a current organisation before it reads anything, stayed empty
 * although the phone held the user's roles and projects from the last sync.
 *
 * Both answers go through `buildMembership`, so offline cannot disagree with
 * online about the same rows.
 */
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import type UserRoleRecord from '../database/models/UserRole'
import type Organisation from '../database/models/Organisation'
import type { UserOrganisation, UserRole } from '../redux/api/auth/types'
import { getStorageData, storeDataToStorage } from '../utils/helpers'
import { log, logWarn } from '../utils/logger'
import { isNetworkOrRetryable } from '../utils/networkErrors'

export interface OrganisationMembership {
    organisations: UserOrganisation[]
    role: UserRole
    organisationId: string | null
}

/** A role row as both the cloud and the local table give it. */
export interface RoleRow {
    role: string
    scope_type: string
    scope_id: string | null
}

/** An organisation row, cloud or local. */
export interface OrgRow {
    id: string
    name: string
    slug?: string | null
}

/**
 * The user's active roles, and the organisations they name, as the app's
 * membership. Only organisation-scoped roles make an organisation; a system or
 * global role raises the role in each of them.
 *
 * `preferredOrgId` is the organisation the user last had open. It becomes the
 * current one only while the roles still allow it; otherwise the first does.
 */
export function buildMembership(
    userRoles: RoleRow[],
    orgs: OrgRow[],
    preferredOrgId?: string | null,
): OrganisationMembership {
    const orgIds = [...new Set(userRoles
        .filter(r => r.scope_type === 'organisation' && r.scope_id)
        .map(r => r.scope_id as string))]

    const systemRole = userRoles.find(r => r.scope_type === 'system' || r.scope_type === 'global')

    const organisations: UserOrganisation[] = orgIds.map((orgId) => {
        const org = orgs.find(o => o.id === orgId)
        const orgRole = userRoles.find(r => r.scope_type === 'organisation' && r.scope_id === orgId)
        // System ww_admin role takes precedence over org-specific roles
        const role = systemRole?.role || orgRole?.role || 'project_member'
        return { id: org?.id || '', name: org?.name || '', role: role as UserRole }
    })

    // Highest privilege role (ww_admin > project_admin > project_member)
    const allRoles = organisations.map(o => o.role)
    const role: UserRole = allRoles.includes('ww_admin')
        ? 'ww_admin'
        : allRoles.includes('project_admin')
            ? 'project_admin'
            : 'project_member'

    const organisationId = preferredOrgId && orgIds.includes(preferredOrgId)
        ? preferredOrgId
        : orgIds.length > 0 ? orgIds[0] : null

    return { organisations, role, organisationId }
}

// Shared with the rest of the app; re-exported here because it decides the fallback above.
export { isNetworkOrRetryable }

/**
 * The membership from what the last sync left on the phone: the user's active
 * rows in `user_roles`, filled by `SupabaseSyncService.syncUserRoles`, and the
 * names in `organisations`, filled by `saveOrganisationsLocally` whenever the
 * cloud answers. An organisation whose name has not reached the phone yet is
 * still returned, with an empty name, so its projects open.
 *
 * `cloudRoles` is used instead of the local rows when the cloud answered the
 * roles and only the organisations query failed.
 */
export async function readLocalMembership(
    userId: string,
    options?: { cloudRoles?: RoleRow[]; preferredOrgId?: string | null },
): Promise<OrganisationMembership> {
    let roles = options?.cloudRoles
    if (!roles) {
        const records = await database.get<UserRoleRecord>('user_roles').query(
            Q.where('user_id', userId),
            Q.where('is_active', true),
        ).fetch()
        roles = records.map(r => ({ role: r.role, scope_type: r.scopeType, scope_id: r.scopeId ?? null }))
    }

    const orgIds = [...new Set(roles
        .filter(r => r.scope_type === 'organisation' && r.scope_id)
        .map(r => r.scope_id as string))]
    const orgs = orgIds.length === 0 ? [] : (await database.get<Organisation>('organisations').query(
        Q.where('id', Q.oneOf(orgIds)),
    ).fetch()).map(o => ({ id: o.id, name: o.name }))

    const membership = buildMembership(roles, orgs, options?.preferredOrgId)
    log(`🏢 Organisations from the local database: ${membership.organisations.length} (${orgs.length} with a name), current ${membership.organisationId}`)
    return membership
}

/**
 * Keep the organisations the cloud just returned, so the next offline start can
 * name them. Nothing else writes this table.
 */
export async function saveOrganisationsLocally(orgs: OrgRow[]): Promise<void> {
    const rows = orgs.filter(o => o.id)
    if (rows.length === 0) return
    const collection = database.get<Organisation>('organisations')
    await database.write(async () => {
        const existing = await collection.query(Q.where('id', Q.oneOf(rows.map(o => o.id)))).fetch()
        const byId = new Map(existing.map(o => [o.id, o]))
        const operations = rows.map((org) => {
            const found = byId.get(org.id)
            if (found) {
                return found.prepareUpdate((rec) => {
                    rec.name = org.name
                    if (org.slug) rec.slug = org.slug
                })
            }
            return collection.prepareCreate((rec) => {
                rec._raw.id = org.id
                rec.name = org.name
                rec.slug = org.slug ?? ''
                rec.isActive = true
                rec.modifiedBy = 'system'
            })
        })
        await database.batch(operations)
    })
}

const currentOrganisationKey = (userId: string) => `currentOrganisation:${userId}`

/** Remember the organisation the user has open, per user, across restarts. */
export async function rememberCurrentOrganisation(userId: string, organisationId: string | null): Promise<void> {
    if (!userId || !organisationId) return
    await storeDataToStorage(currentOrganisationKey(userId), organisationId)
}

/** The organisation this user last had open, or null. Not checked against any roles. */
export async function recallCurrentOrganisation(userId: string): Promise<string | null> {
    if (!userId) return null
    const stored = await getStorageData<string>(currentOrganisationKey(userId))
    return typeof stored === 'string' ? stored : null
}

/**
 * `saveOrganisationsLocally` without waiting and without failing: the write
 * queues behind any sync write in progress, and the membership must not.
 */
export const saveOrganisationsLocallyQuietly = (orgs: OrgRow[]) =>
    saveOrganisationsLocally(orgs).catch(e => logWarn('⚠️ Could not keep organisations locally:', e))
