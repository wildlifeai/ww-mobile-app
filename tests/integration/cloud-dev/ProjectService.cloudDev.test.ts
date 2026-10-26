/**
 * ProjectService against cloud-dev, through the real sync push (#489).
 *
 * The suite this replaces needed a local Supabase and the service-role key to
 * create its own users and organisations, so it stayed `describe.skip` until
 * #491 removed it. This one uses what CI already has: the seeded cloud-dev
 * account of the E2E Full flows (Testing Guide, "The account the flows use")
 * and the anon key. Cloud-dev is wiped and reseeded by every ww-backend dev
 * deploy, so it relies on nothing but that account and its organisation.
 *
 * It creates one project the way the app does (WatermelonDB, the outbox, then
 * `push_changes`), checks it on the server, edits it, deletes it, and checks
 * that the server shows this account only projects its roles allow. Every
 * project it creates is soft-deleted at the end, even when a step fails.
 *
 * Skipped unless all four are set: E2E_TEST_EMAIL, E2E_TEST_PASSWORD,
 * EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (cloud-dev's).
 * Nothing is loaded when skipped, so `npm test` is unaffected. In CI it runs in
 * native-build-validation.yml's `cloud-dev-integration` job, on the `full-e2e`
 * label or by hand.
 */

const EMAIL = process.env.E2E_TEST_EMAIL
const PASSWORD = process.env.E2E_TEST_PASSWORD
const configured = !!(EMAIL && PASSWORD && process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const describeCloudDev = configured ? describe : describe.skip

jest.unmock('@supabase/supabase-js')
jest.unmock('../../../src/services/supabase')
jest.mock('../../../src/utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// The app's database, in memory: LokiJS with the generated schema, and UUIDs
// for ids as on the phone, since the server's ids are uuid columns
jest.mock('../../../src/database', () => {
	const { Database } = require('@nozbe/watermelondb')
	const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
	const { setGenerator } = require('@nozbe/watermelondb/utils/common/randomId')
	require('@nozbe/watermelondb/utils/common/logger').default.silence()
	setGenerator(() => require('crypto').randomUUID())
	const model = (name: string) => require(`../../../src/database/models/${name}`).default
	return {
		__esModule: true,
		default: new Database({
			adapter: new LokiJSAdapter({
				schema: require('../../../src/database/schema').default,
				useWebWorker: false,
				useIncrementalIndexedDB: false,
				extraLokiOptions: { autosave: false },
			}),
			modelClasses: [
				'Project', 'Deployment', 'User', 'Organisation', 'SyncOutbox', 'SyncState', 'UserRole',
				'ProjectInvitation', 'Device', 'Firmware', 'CaptureMethod', 'ActivitySensitivity',
				'AiModel', 'AiModelFamily', 'SamplingDesign',
			].map(model),
		}),
	}
})

describeCloudDev('ProjectService against cloud-dev (#489)', () => {
	jest.setTimeout(60_000)

	let client: any
	let ProjectService: any
	let SupabaseSyncService: any
	let database: any
	let userId: string
	let organisationId: string
	let projectId: string | undefined
	const created: string[] = []
	const name = `CI ProjectService ${process.env.GITHUB_RUN_ID ?? 'local'} ${new Date().toISOString()}`

	/** The project's outbox operations, oldest first */
	const outboxFor = async (id: string) => {
		const { Q } = require('@nozbe/watermelondb')
		return database.get('sync_outbox').query(Q.where('record_id', id), Q.sortBy('lamport_clock', Q.asc)).fetch()
	}
	/** The server's live row for the project, as this account may read it */
	const serverProject = async (id: string) => {
		const { data, error } = await client.from('projects').select('*').eq('id', id).maybeSingle()
		if (error) throw error
		return data
	}
	const push = () => SupabaseSyncService.uploadOutbox(userId)

	beforeAll(async () => {
		jest.useRealTimers()
		const { initializeSupabaseClient } = require('../../../src/services/supabase')
		client = await initializeSupabaseClient()
		const { data, error } = await client.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! })
		if (error) throw new Error(`Could not sign in as the seeded account: ${error.message}`)
		userId = data.user.id

		// Creating a project needs organisation_member of its organisation
		const { data: roles, error: rolesError } = await client.from('user_roles')
			.select('role, scope_id')
			.eq('user_id', userId)
			.eq('scope_type', 'organisation')
			.eq('is_active', true)
			.is('deleted_at', null)
		if (rolesError) throw rolesError
		const member = (roles ?? []).find((r: any) => r.role === 'organisation_member')
		if (!member) throw new Error('The seeded account has no organisation_member role, so it cannot create a project')
		organisationId = member.scope_id

		ProjectService = require('../../../src/services/ProjectService').default
		SupabaseSyncService = require('../../../src/services/SupabaseSyncService').default
		database = require('../../../src/database').default
	})

	// sanitySetup turns fake timers on before every test; the network needs real ones
	beforeEach(() => jest.useRealTimers())

	afterAll(async () => {
		if (!client) return
		for (const id of created) {
			const { error } = await client.rpc('soft_delete_project', { p_id: id })
			if (error) console.warn(`Could not soft-delete CI project ${id} on cloud-dev: ${error.message}`)
		}
		await client.auth.signOut()
	})

	it('creates a project in the organisation and pushes it', async () => {
		const project = await ProjectService.createProject({ name, description: 'Created by the ProjectService cloud-dev suite', organisation_id: organisationId })
		projectId = project.id
		created.push(project.id)

		await push()

		const [create] = await outboxFor(project.id)
		expect(create.status).toBe('synced')
		const row = await serverProject(project.id)
		expect(row).toEqual(expect.objectContaining({ id: project.id, name, organisation_id: organisationId, created_by: userId }))
	})

	// cross-repo-contracts.md, "Creator role on a new project": the phone writes
	// a local project_admin row for the creator, mirroring the server's trigger
	it('gets the creator the same project_admin role the phone gave itself', async () => {
		const { data, error } = await client.from('user_roles')
			.select('role, scope_type')
			.eq('user_id', userId)
			.eq('scope_id', projectId)
			.eq('is_active', true)
			.is('deleted_at', null)
		if (error) throw error
		expect(data).toEqual([{ role: 'project_admin', scope_type: 'project' }])
	})

	// push_changes keeps a column an update leaves out (ww-backend #172)
	it('pushes an edit, and keeps the columns the edit left out', async () => {
		const before = await serverProject(projectId!)
		await ProjectService.updateProject(projectId!, { description: 'Edited by the ProjectService cloud-dev suite' })

		await push()

		const after = await serverProject(projectId!)
		expect(after.description).toBe('Edited by the ProjectService cloud-dev suite')
		expect(after.flash_mode).toBe(before.flash_mode)
		expect(after.detection_threshold_pct).toBe(before.detection_threshold_pct)
	})

	it('shows this account only projects its roles allow', async () => {
		const [{ data: projects, error }, { data: roles, error: rolesError }] = await Promise.all([
			client.from('projects').select('id, organisation_id, created_by'),
			client.from('user_roles').select('role, scope_type, scope_id').eq('user_id', userId).eq('is_active', true).is('deleted_at', null),
		])
		if (error) throw error
		if (rolesError) throw rolesError
		if ((roles ?? []).some((r: any) => r.role === 'ww_admin')) return // reads everything

		// can_read_project (functions/31_can_read_synced_rows.sql): a project role,
		// the creator, or organisation_manager of its organisation
		const projectScopes = new Set(roles.filter((r: any) => r.scope_type === 'project').map((r: any) => r.scope_id))
		const managed = new Set(roles.filter((r: any) => r.role === 'organisation_manager').map((r: any) => r.scope_id))
		const unexplained = (projects ?? []).filter((p: any) =>
			!projectScopes.has(p.id) && p.created_by !== userId && !managed.has(p.organisation_id))
		expect(unexplained).toEqual([])
	})

	it('deletes the project on the server', async () => {
		await ProjectService.deleteProject(projectId!)

		await push()

		const ops = await outboxFor(projectId!)
		expect(ops.map((op: any) => op.operationType)).toEqual(['CREATE', 'UPDATE', 'DELETE'])
		expect(ops.map((op: any) => op.status)).toEqual(['synced', 'synced', 'synced'])
		// Soft-deleted rows are hidden from every client read
		expect(await serverProject(projectId!)).toBeNull()
		created.splice(created.indexOf(projectId!), 1)
	})
})
