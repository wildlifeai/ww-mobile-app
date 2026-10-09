/**
 * The push half of a sync (#287), the account a sync runs as (#267), projects
 * that disappear from the server (#330), and deployments edited, deleted or
 * moved on the website (#411).
 *
 * The database is an in-memory fake, so these assert on what each outbox
 * operation ends up as, and on what push_changes was actually sent.
 */
import SupabaseSyncService from '../SupabaseSyncService'
import SyncStateService, { SYNC_STATE_KEYS, PULL_WATERMARK_KEYS } from '../SyncStateService'
import OutboxService from '../OutboxService'
import ProjectService from '../ProjectService'
import { DeploymentService, DEPLOYMENT_STATUS } from '../DeploymentService'
import { GONE_FROM_SERVER } from '../goneFromServer'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

jest.mock('../SyncStateService', () => {
	const actual = jest.requireActual('../SyncStateService')
	const mockState = new Map<string, string>()
	return {
		__esModule: true,
		SYNC_STATE_KEYS: actual.SYNC_STATE_KEYS,
		PULL_WATERMARK_KEYS: actual.PULL_WATERMARK_KEYS,
		default: {
			state: mockState,
			get: jest.fn(async (key: string) => mockState.get(key) ?? null),
			set: jest.fn(async (key: string, value: string) => { mockState.set(key, value) }),
			delete: jest.fn(async (key: string) => { mockState.delete(key) }),
			isSyncInProgress: jest.fn(async () => false),
			getLastPullTimestamp: jest.fn(async () => 0),
		},
	}
})

jest.mock('../DeploymentPhotoService', () => ({
	DeploymentPhotoService: { uploadAllPending: jest.fn(() => Promise.resolve()) },
}))

const mockRpc = jest.fn()
const mockFrom = jest.fn()
const mockGetUser = jest.fn()
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		rpc: mockRpc,
		from: mockFrom,
		auth: {
			getUser: mockGetUser,
			getSession: async () => {
				const { data } = await mockGetUser()
				return { data: { session: data.user ? { user: data.user } : null } }
			},
			// ProjectService reads the user from the stored session (#310), under
			// the client's own storage key, rather than asking auth-js for one
			storageKey: 'sb-test-auth-token',
			storage: {
				getItem: async () => {
					const { data } = await mockGetUser()
					return data.user ? JSON.stringify({ refresh_token: 'refresh', user: data.user }) : null
				},
			},
		},
	}),
}))

const USER_A = 'user-a'
const USER_B = 'user-b'

// Rows the "server" has and shows this account, per table. projects_with_stats
// answers from the projects rows, as the view does. user_roles and devices
// answer with whole rows, the other tables with ids.
let serverRows: Record<string, { id: string, deleted_at?: string | null, [column: string]: any }[]>
// The watermark each pull asked from, per table
let pulledSince: Record<string, string>
// A table whose reads fail, and a count the server claims instead of the real one
let readErrors: Record<string, any>
let claimedCount: Record<string, number>
// What an incremental pull of a table returns
let pullRows: Record<string, any[]>
// The `changes` pull_changes answers with, such as its deleted lists
let pullChanges: Record<string, any>
// The ids each read by id asked for, per table
let readById: Record<string, string[][]>
// Decides what push_changes answers for one call's `changes`
let pushHandler: (changes: any) => { data?: any, error?: any }
const pushCalls: any[] = []

const state = (SyncStateService as any).state as Map<string, string>
const service = SupabaseSyncService as any

const queue = (fields: {
	id: string
	table: string
	type: 'CREATE' | 'UPDATE' | 'DELETE'
	recordId: string
	payload?: Record<string, any>
	userId?: string
	status?: string
	clock?: number
}) => seedRows('sync_outbox', [{
	id: fields.id,
	operationId: `op-${fields.id}`,
	operationType: fields.type,
	tableName: fields.table,
	recordId: fields.recordId,
	payload: JSON.stringify({ id: fields.recordId, ...(fields.payload ?? {}) }),
	status: fields.status ?? 'pending',
	retryCount: 0,
	userId: fields.userId,
	lamportClock: fields.clock ?? 0,
}])[0]

const op = (id: string) => rowsIn('sync_outbox').find((r) => r.id === id)!

/** The ids push_changes was sent for a table, one array per call */
const sentIds = (table: string) => pushCalls
	.filter((changes) => ['created', 'updated', 'deleted'].some((k) => changes[table][k].length > 0))
	.map((changes) => [
		...changes[table].created.map((r: any) => r.id),
		...changes[table].updated.map((r: any) => r.id),
		...changes[table].deleted,
	])

beforeEach(() => {
	resetFakeDatabase()
	state.clear()
	pushCalls.length = 0
	serverRows = { projects: [], devices: [] }
	pulledSince = {}
	readErrors = {}
	claimedCount = {}
	pullRows = {}
	pullChanges = {}
	readById = {}
	pushHandler = () => ({ data: { processed: 1, conflicts: [] }, error: null })

	mockRpc.mockReset().mockImplementation(async (name: string, args: any) => {
		if (name === 'pull_changes') {
			return { data: { changes: pullChanges, timestamp: 1000 }, error: null }
		}
		if (name === 'push_changes') {
			pushCalls.push(args.changes)
			return pushHandler(args.changes)
		}
		return { data: null, error: null }
	})
	mockFrom.mockReset().mockImplementation((table: string) => {
		const filters: ((row: any) => boolean)[] = []
		let since: string | undefined
		let counted = false
		const run = () => {
			if (readErrors[table]) return { data: null, error: readErrors[table], count: null }
			// An incremental pull: remember where it asked from
			if (since !== undefined) {
				pulledSince[table] = since
				return { data: pullRows[table] ?? [], error: null }
			}
			const source = table === 'projects_with_stats' ? 'projects' : table
			const rows = (serverRows[source] ?? []).filter((row) => filters.every((f) => f(row)))
			return {
				data: rows.map((row) => (table === 'user_roles' || table === 'devices' ? { ...row } : { id: row.id })),
				error: null,
				count: counted ? (claimedCount[table] ?? rows.length) : null,
			}
		}
		const chain: any = {
			select: (_columns: string, options?: { count?: string }) => {
				counted = options?.count === 'exact'
				return chain
			},
			in: (_column: string, ids: string[]) => {
				filters.push((row) => ids.includes(row.id))
				readById[table] = [...(readById[table] ?? []), ids]
				return chain
			},
			is: (column: string, value: any) => {
				filters.push((row) => (row[column] ?? null) === value)
				return chain
			},
			eq: (column: string, value: any) => {
				filters.push((row) => row[column] === value)
				return chain
			},
			gt: (_column: string, value: string) => {
				since = value
				return chain
			},
			then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
		}
		return chain
	})
	mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: USER_B } } })
})

describe('push (#287)', () => {
	// The bench case: a refused device insert used to stop the deployments behind it
	const devicesRefusedScenario = () => {
		queue({ id: 'p1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B })
		queue({ id: 'd-new', table: 'devices', type: 'CREATE', recordId: 'device-new', userId: USER_B })
		queue({ id: 'd-old', table: 'devices', type: 'CREATE', recordId: 'device-old', userId: USER_B })
		queue({ id: 'dep1', table: 'deployments', type: 'CREATE', recordId: 'dep-1', userId: USER_B,
			payload: { project_id: 'project-1', device_id: 'device-new' } })
		queue({ id: 'dep2', table: 'deployments', type: 'CREATE', recordId: 'dep-2', userId: USER_B,
			payload: { project_id: 'project-1', device_id: 'device-old' } })

		// device-old is already on the server, so its CREATE is an ON CONFLICT no-op
		serverRows.devices = [{ id: 'device-old' }]
		serverRows.projects = [{ id: 'project-1' }]
		pushHandler = (changes) => {
			const deviceIds = changes.devices.created.map((r: any) => r.id)
			if (deviceIds.includes('device-new')) {
				return { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "devices"' } }
			}
			if (deviceIds.includes('device-old')) {
				return { data: { processed: 0, conflicts: [{ id: 'device-old', reason: 'not_applied' }] }, error: null }
			}
			return { data: { processed: 1, conflicts: [] }, error: null }
		}
	}

	it('lets independent work through when one device is refused, and holds only its deployment', async () => {
		devicesRefusedScenario()

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('Push incomplete')

		expect(op('p1').status).toBe('synced')
		expect(op('d-old').status).toBe('synced')
		expect(op('d-new').status).toBe('failed')
		expect(op('d-new').errorMessage).toContain('row-level security')
		expect(op('dep2').status).toBe('synced')
		// Its device never reached the server, so it waits rather than failing a foreign key
		expect(op('dep1').status).toBe('pending')
		expect(op('dep1').errorMessage).toMatch(/waiting/i)

		// The refused batch was retried one device at a time, and dep-1 was never sent
		expect(sentIds('devices')).toEqual([['device-new', 'device-old'], ['device-new'], ['device-old']])
		expect(sentIds('deployments')).toEqual([['dep-2']])
	})

	it('names each table and why in the error', async () => {
		devicesRefusedScenario()

		const error: Error = await service.uploadOutbox(USER_B).catch((e: Error) => e)

		expect(error.message).toContain('projects: 1 saved')
		expect(error.message).toContain('devices: 1 saved, 1 refused by the server (42501 new row violates row-level security policy')
		expect(error.message).toContain('deployments: 1 saved, 1 waiting for their project or device to reach the server')
	})

	it('pushes a deployment whose refused device is already on the server', async () => {
		queue({ id: 'd1', table: 'devices', type: 'CREATE', recordId: 'device-1', userId: USER_B })
		queue({ id: 'dep1', table: 'deployments', type: 'CREATE', recordId: 'dep-1', userId: USER_B,
			payload: { project_id: 'project-1', device_id: 'device-1' } })
		serverRows.devices = [{ id: 'device-1' }]
		serverRows.projects = [{ id: 'project-1' }]
		pushHandler = (changes) => changes.devices.created.length > 0
			? { data: null, error: { code: '42501', message: 'refused' } }
			: { data: { processed: 1, conflicts: [] }, error: null }

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('devices: 1 refused by the server')

		expect(op('d1').status).toBe('failed')
		expect(op('dep1').status).toBe('synced')
	})

	it('keeps an update the server did not apply queued instead of marking it synced', async () => {
		queue({ id: 'u1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B })
		queue({ id: 'c1', table: 'projects', type: 'CREATE', recordId: 'project-2', userId: USER_B })
		pushHandler = () => ({
			data: { processed: 0, conflicts: [{ id: 'project-1', reason: 'not_applied' }, { id: 'project-2', reason: 'not_applied' }] },
			error: null,
		})

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('projects: 1 saved, 1 not applied by the server')

		expect(op('u1').status).toBe('failed')
		expect(op('u1').errorMessage).toContain('not_applied')
		// A CREATE the server skipped is a row it already has
		expect(op('c1').status).toBe('synced')
	})

	it('marks a batch that could not be sent as failed, not left syncing', async () => {
		queue({ id: 'p1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B })
		mockRpc.mockImplementation(async (name: string) => {
			if (name === 'push_changes') throw new Error('Network request failed')
			return { data: null, error: null }
		})

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('projects: 1 not sent (Network request failed)')

		expect(op('p1').status).toBe('failed')
	})

	it('resumes operations a cut-short sync left in syncing', async () => {
		queue({ id: 'p1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B, status: 'syncing' })

		await service.uploadOutbox(USER_B)

		expect(op('p1').status).toBe('synced')
		expect(sentIds('projects')).toEqual([['project-1']])
	})
})

describe('another account on the same phone (#267)', () => {
	it('holds the previous account\'s unsynced changes instead of pushing them as this account', async () => {
		queue({ id: 'a-project', table: 'projects', type: 'UPDATE', recordId: 'project-a', userId: USER_A })
		queue({ id: 'a-deployment', table: 'deployments', type: 'CREATE', recordId: 'dep-a', userId: USER_A,
			payload: { project_id: 'project-a', device_id: 'device-a', setup_by: USER_A } })
		// Registering the camera is nobody's work, and this account may be deploying it
		queue({ id: 'a-device', table: 'devices', type: 'CREATE', recordId: 'device-a', userId: USER_A })
		queue({ id: 'b-project', table: 'projects', type: 'UPDATE', recordId: 'project-b', userId: USER_B })

		await service.uploadOutbox(USER_B)

		expect(op('a-project').status).toBe('pending')
		expect(op('a-deployment').status).toBe('pending')
		expect(op('a-device').status).toBe('synced')
		expect(op('b-project').status).toBe('synced')
		expect(sentIds('projects')).toEqual([['project-b']])
		expect(sentIds('deployments')).toEqual([])
	})

	it('pushes them once their account syncs again', async () => {
		queue({ id: 'a-project', table: 'projects', type: 'UPDATE', recordId: 'project-a', userId: USER_A })

		await service.uploadOutbox(USER_A)

		expect(op('a-project').status).toBe('synced')
	})

	it('clears the pull watermarks when a different account syncs, and only then', async () => {
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_A)
		for (const key of PULL_WATERMARK_KEYS) state.set(key, '1756900000000')

		await service.resetWatermarksOnUserChange(USER_B)

		for (const key of PULL_WATERMARK_KEYS) expect(state.has(key)).toBe(false)
		expect(state.get(SYNC_STATE_KEYS.LAST_SYNC_USER_ID)).toBe(USER_B)

		state.set(SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT, '1756900000000')
		await service.resetWatermarksOnUserChange(USER_B)
		expect(state.get(SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT)).toBe('1756900000000')
	})

	it('gives the second account a full pull of its projects, and all of its roles', async () => {
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_A)
		state.set(SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT, String(Date.parse('2026-09-03T23:41:52.332Z')))
		// Granted long before the first account's last sync (#375 reads every role, every sync)
		serverRows.user_roles = [{
			id: 'b-general', user_id: USER_B, role: 'organisation_member', scope_type: 'organisation',
			scope_id: 'org-general', is_active: true, updated_at: '2026-06-01T00:00:00Z',
		}]
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: true } }),
			dispatch: jest.fn(),
		})

		await SupabaseSyncService.sync()

		expect(rowsIn('user_roles').map((r) => r.id)).toEqual(['b-general'])
		expect(pulledSince.projects_with_stats).toBe(new Date(0).toISOString())
	})
})

describe('sync after a refused push (#287)', () => {
	it('still pulls, marks the initial sync complete, then reports the push', async () => {
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_B)
		queue({ id: 'd1', table: 'devices', type: 'CREATE', recordId: 'device-1', userId: USER_B })
		pushHandler = () => ({ data: null, error: { code: '42501', message: 'refused' } })
		const dispatch = jest.fn()
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: false } }),
			dispatch,
		})

		await expect(SupabaseSyncService.sync()).rejects.toThrow('devices: 1 refused by the server')

		expect(mockFrom).toHaveBeenCalledWith('user_roles')
		expect(pulledSince.deployments).toBeDefined()
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync/markInitialSyncComplete' }))
		expect(state.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)).toContain('devices: 1 refused by the server')
	})
})

describe('a project gone from the server (#330)', () => {
	// The bench phone on 29 September 2026, cloud dev: "Test night" was created
	// on the phone on 21 September and wiped by the 24 September reset
	const TAMA = 'a0000000-0000-0000-0000-000000000002'
	const TEST_NIGHT = '365ce726-90b0-494e-bdee-fa3894a6505c'
	const SINBAD = 'c0000000-0000-0000-0000-000000000005'
	const GLOBAL = 'c0000000-0000-0000-0000-000000000099'
	const DEVICE = '84004dec-d50b-429b-81c1-9bcce300b467'
	const SYNCED_ON_TEST_NIGHT = ['2c35c953-5f38-4667-afea-62728c418adc', '859b722a-7a1a-4bad-acd8-10739b9f4499']
	const UNSYNCED_ON_TEST_NIGHT = ['37757ff1-40a7-43b5-8c58-b948d06913e1', '019bbce7-785b-4f6a-bfa3-e6300fbd0480']
	const ON_SINBAD = 'ba37e314-ae9d-441d-a2ba-3bfffe644508'

	const benchPhone = () => {
		seedRows('projects', [
			{ id: TEST_NIGHT, name: 'Test night', createdBy: TAMA },
			{ id: SINBAD, name: 'Sinbad Skink Survey' },
			{ id: GLOBAL, name: 'Global Testing Project' },
		])
		seedRows('deployments', [
			...SYNCED_ON_TEST_NIGHT.map((id) => ({ id, projectId: TEST_NIGHT, deviceId: DEVICE, cameraLocationImagePaths: [] })),
			...UNSYNCED_ON_TEST_NIGHT.map((id) => ({ id, projectId: TEST_NIGHT, deviceId: DEVICE, cameraLocationImagePaths: [] })),
			{ id: ON_SINBAD, projectId: SINBAD, deviceId: DEVICE, cameraLocationImagePaths: [] },
			{ id: 'sinbad-synced', projectId: SINBAD, deviceId: DEVICE, cameraLocationImagePaths: [] },
		])
		seedRows('user_roles', [
			{ id: 'role-test-night', userId: TAMA, role: 'project_admin', scopeType: 'project', scopeId: TEST_NIGHT, isActive: true },
			{ id: 'role-sinbad', userId: TAMA, role: 'project_admin', scopeType: 'project', scopeId: SINBAD, isActive: true },
			{ id: 'role-global', userId: TAMA, role: 'project_member', scopeType: 'project', scopeId: GLOBAL, isActive: true },
		])
		for (const id of SYNCED_ON_TEST_NIGHT) {
			queue({ id: `create-${id}`, table: 'deployments', type: 'CREATE', recordId: id, userId: TAMA, status: 'synced',
				payload: { project_id: TEST_NIGHT, device_id: DEVICE } })
		}
		// The failed operations as they were in sync_outbox
		for (const id of UNSYNCED_ON_TEST_NIGHT) {
			queue({ id: `create-${id}`, table: 'deployments', type: 'CREATE', recordId: id, userId: TAMA, status: 'failed',
				payload: { project_id: TEST_NIGHT, device_id: DEVICE } })
			queue({ id: `update-${id}`, table: 'deployments', type: 'UPDATE', recordId: id, userId: TAMA, status: 'failed',
				payload: { project_id: TEST_NIGHT, device_id: DEVICE } })
		}
		// Refused only because it went up in the same call as the Test night rows
		queue({ id: `create-${ON_SINBAD}`, table: 'deployments', type: 'CREATE', recordId: ON_SINBAD, userId: TAMA, status: 'failed',
			payload: { project_id: SINBAD, device_id: DEVICE } })

		serverRows.projects = [{ id: SINBAD }, { id: GLOBAL }]
		serverRows.devices = [{ id: DEVICE }]
		// As on the bench: a call carrying a Test night deployment is refused whole
		pushHandler = (changes) => {
			const rows = [...changes.deployments.created, ...changes.deployments.updated]
			return rows.some((row: any) => row.project_id === TEST_NIGHT)
				? { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "deployments"' } }
				: { data: { processed: rows.length, conflicts: [] }, error: null }
		}
		mockGetUser.mockResolvedValue({ data: { user: { id: TAMA } } })
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, TAMA)
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: true } }),
			dispatch: jest.fn(),
		})
	}

	const ids = (table: string) => rowsIn(table).map((r) => r.id).sort()
	const testNightOps = () => UNSYNCED_ON_TEST_NIGHT.flatMap((id) => [op(`create-${id}`), op(`update-${id}`)])

	it('does not push a deployment into a project the server no longer has, and pushes the rest', async () => {
		benchPhone()

		await expect(service.uploadOutbox(TAMA)).rejects.toThrow('deployments: 1 saved, 4 waiting')

		expect(sentIds('deployments')).toEqual([[ON_SINBAD]])
		expect(op(`create-${ON_SINBAD}`).status).toBe('synced')
		for (const queued of testNightOps()) expect(queued.status).toBe('pending')
	})

	it('removes the project with its synced deployments and roles, and keeps the unsynced work as orphaned', async () => {
		benchPhone()

		await SupabaseSyncService.sync().catch(() => {})

		expect(ids('projects')).toEqual([SINBAD, GLOBAL].sort())
		expect(ids('deployments')).toEqual([...UNSYNCED_ON_TEST_NIGHT, ON_SINBAD, 'sinbad-synced'].sort())
		expect(ids('user_roles')).toEqual(['role-global', 'role-sinbad'])
		for (const orphaned of testNightOps()) {
			expect(orphaned.status).toBe('orphaned')
			expect(orphaned.errorMessage).toContain('"Test night"')
		}
		expect((await OutboxService.getStatistics()).orphaned).toBe(4)
		expect(await OutboxService.getOrphanedOperations()).toHaveLength(4)
	})

	it('stops retrying them: the next sync sends nothing and reports no error', async () => {
		benchPhone()
		await SupabaseSyncService.sync().catch(() => {})
		pushCalls.length = 0

		await expect(SupabaseSyncService.sync()).resolves.toBeUndefined()

		expect(pushCalls).toHaveLength(0)
		expect(state.has(SYNC_STATE_KEYS.LAST_SYNC_ERROR)).toBe(false)
	})

	it('treats a project deleted on the website as gone', async () => {
		benchPhone()
		serverRows.projects = [{ id: SINBAD }, { id: GLOBAL }, { id: TEST_NIGHT, deleted_at: '2026-09-29T03:00:00Z' }]

		await service.reconcileProjects(TAMA)

		expect(ids('projects')).not.toContain(TEST_NIGHT)
	})

	it('keeps a project whose CREATE is still queued or in flight', async () => {
		benchPhone()
		seedRows('projects', [{ id: 'new-offline', name: 'Made offline' }, { id: 'in-flight', name: 'Going up' }])
		queue({ id: 'create-new', table: 'projects', type: 'CREATE', recordId: 'new-offline', userId: TAMA, status: 'failed' })
		queue({ id: 'create-flight', table: 'projects', type: 'CREATE', recordId: 'in-flight', userId: TAMA, status: 'syncing' })

		await service.reconcileProjects(TAMA)

		expect(ids('projects')).toEqual(expect.arrayContaining(['new-offline', 'in-flight']))
		expect(op('create-new').status).toBe('failed')
	})

	it('keeps a synced deployment whose photo is still only on the phone', async () => {
		benchPhone()
		rowsIn('deployments').find((d) => d.id === SYNCED_ON_TEST_NIGHT[0])!.cameraLocationImagePaths =
			['file:///data/deployment-photos/1.jpg']

		await service.reconcileProjects(TAMA)

		expect(ids('deployments')).toContain(SYNCED_ON_TEST_NIGHT[0])
		expect(ids('deployments')).not.toContain(SYNCED_ON_TEST_NIGHT[1])
	})

	it('leaves another account\'s held changes to that account', async () => {
		benchPhone()
		for (const queued of testNightOps()) queued.userId = USER_A

		await service.reconcileProjects(TAMA)

		for (const held of testNightOps()) expect(held.status).toBe('failed')
		expect(ids('deployments')).toEqual(expect.arrayContaining(UNSYNCED_ON_TEST_NIGHT))
	})

	it('queues orphaned changes again when their project comes back', async () => {
		benchPhone()
		await service.reconcileProjects(TAMA)
		serverRows.projects.push({ id: TEST_NIGHT })

		await service.reconcileProjects(TAMA)

		for (const back of testNightOps()) expect(back.status).toBe('pending')
	})

	it('asks for a full pull when the server lists a project the phone does not have', async () => {
		benchPhone()
		serverRows.projects.push({ id: 'granted-long-ago' })
		for (const key of PULL_WATERMARK_KEYS) state.set(key, '1790238775086')

		await service.reconcileProjects(TAMA)

		expect(state.has(SYNC_STATE_KEYS.PROJECTS_LAST_PULLED_AT)).toBe(false)
		expect(state.has(SYNC_STATE_KEYS.DEPLOYMENTS_LAST_PULLED_AT)).toBe(false)
	})

	describe('does nothing on an answer it cannot trust', () => {
		const untouched = () => {
			expect(ids('projects')).toContain(TEST_NIGHT)
			expect(ids('user_roles')).toContain('role-test-night')
			for (const queued of testNightOps()) expect(queued.status).not.toBe('orphaned')
		}

		it('an empty list, as from an RLS or auth hiccup', async () => {
			benchPhone()
			serverRows.projects = []
			await service.reconcileProjects(TAMA)
			untouched()
		})

		it('a list that would remove every project on the phone', async () => {
			benchPhone()
			serverRows.projects = [{ id: 'someone-elses' }]
			await service.reconcileProjects(TAMA)
			untouched()
			expect(ids('projects')).toHaveLength(3)
		})

		it('a list shorter than its own count', async () => {
			benchPhone()
			claimedCount.projects_with_stats = 3
			await service.reconcileProjects(TAMA)
			untouched()
		})

		it('a failed read', async () => {
			benchPhone()
			readErrors.projects_with_stats = { message: 'JWT expired', code: 'PGRST301' }
			await service.reconcileProjects(TAMA)
			untouched()
		})

		it('a project pull that did not complete', async () => {
			benchPhone()
			readErrors.projects_with_stats = { message: 'upstream timeout', code: '' }
			const reconcile = jest.spyOn(service, 'reconcileProjects')

			await SupabaseSyncService.sync().catch(() => {})

			expect(reconcile).not.toHaveBeenCalled()
			untouched()
			reconcile.mockRestore()
		})
	})
})

describe('a project created on this phone', () => {
	// Bench, 29 September 2026: "Offline project" fb7fd590, made in airplane mode
	const createOffline = async () => {
		mockGetUser.mockResolvedValue({ data: { user: { id: USER_B } } })
		await ProjectService.createProject({ name: 'Offline project', organisation_id: 'org-1' } as any)
		return rowsIn('projects')[0].id as string
	}
	const rolesOn = (projectId: string) => rowsIn('user_roles').filter((r) => r.scopeId === projectId)

	it('makes its creator the project admin at once, as the server trigger will', async () => {
		const projectId = await createOffline()

		expect(rolesOn(projectId)).toEqual([expect.objectContaining({
			userId: USER_B,
			role: 'project_admin',
			scopeType: 'project',
			isActive: true,
		})])
	})

	it('never queues that role for upload', async () => {
		const projectId = await createOffline()

		expect(rolesOn(projectId)).toHaveLength(1)
		expect(rowsIn('sync_outbox').map((o) => `${o.tableName} ${o.operationType}`)).toEqual(['projects CREATE'])

		serverRows.projects = [{ id: projectId }]
		await service.uploadOutbox(USER_B)
		expect(sentIds('projects')).toEqual([[projectId]])
		for (const changes of pushCalls) expect(changes).not.toHaveProperty('user_roles')
	})

	it('keeps one role once the server\'s own row is pulled', async () => {
		const projectId = await createOffline()
		const [provisional] = rolesOn(projectId)
		expect(provisional).toBeDefined()
		serverRows.user_roles = [{
			id: 'server-role-id',
			user_id: USER_B,
			role: 'project_admin',
			scope_type: 'project',
			scope_id: projectId,
			granted_by: USER_B,
			granted_at: '2026-09-29T04:00:00Z',
			is_active: true,
			modified_by: USER_B,
			created_at: '2026-09-29T04:00:00Z',
			updated_at: '2026-09-29T04:00:00Z',
		}]

		await service.syncUserRoles(USER_B)

		// The server's row updated the provisional one in place
		expect(rolesOn(projectId)).toHaveLength(1)
		expect(rolesOn(projectId)[0].id).toBe(provisional.id)
		expect(rolesOn(projectId)[0]).toEqual(expect.objectContaining({ role: 'project_admin', isActive: true }))
	})
})

describe('a sync asked for while one runs (8 October 2026)', () => {
	// A deployment started on the phone asks for a sync. When one is already
	// running, that one read the outbox before the deployment was queued, and
	// the request used to be dropped: the camera stamped its photos with an id
	// the website did not have until something else synced.
	const { __setNetworkState, __resetNetworkState } = require('@react-native-community/netinfo') as {
		__setNetworkState: (state: { isConnected: boolean }) => void
		__resetNetworkState: () => void
	}
	const store = (isOnline: boolean) => ({
		getState: () => ({ network: { isOnline }, sync: { hasCompletedInitialSync: true } }),
		dispatch: jest.fn(),
	})
	const goOffline = () => {
		SupabaseSyncService.setStore(store(false))
		__setNetworkState({ isConnected: false })
	}
	const pulls = () => mockRpc.mock.calls.filter(([name]) => name === 'pull_changes').length
	/** Lets the promise chains settle; timers are fake here, so no setImmediate */
	const settle = async (until: () => boolean = () => false) => {
		for (let i = 0; i < 2000 && !until(); i++) await Promise.resolve()
	}
	/** Holds the next sync at its pull, by when its push has read the outbox */
	const holdNextPull = () => {
		let release!: () => void
		const gate = new Promise<void>((resolve) => { release = resolve })
		const answer = mockRpc.getMockImplementation()!
		let held = false
		mockRpc.mockImplementation(async (name: string, args: any) => {
			if (name === 'pull_changes' && !held) {
				held = true
				await gate
			}
			return answer(name, args)
		})
		return release
	}
	const queueDeployment = () => queue({ id: 'dep1', table: 'deployments', type: 'CREATE', recordId: 'dep-1', userId: USER_B,
		payload: { project_id: 'project-1', device_id: 'device-1' } })

	beforeEach(() => {
		service.syncAgain = false
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_B)
		serverRows.projects = [{ id: 'project-1' }]
		serverRows.devices = [{ id: 'device-1' }]
		SupabaseSyncService.setStore(store(true))
	})

	afterEach(() => {
		__resetNetworkState()
	})

	it('pushes a deployment queued during a running sync in one more sync when that one ends', async () => {
		const release = holdNextPull()
		const syncs = jest.spyOn(SupabaseSyncService, 'sync')

		const running = SupabaseSyncService.sync()
		await settle(() => pulls() === 1)
		expect(pulls()).toBe(1)

		queueDeployment()
		SupabaseSyncService.requestSync()
		await settle()
		expect(sentIds('deployments')).toEqual([])

		release()
		await running
		expect(syncs).toHaveBeenCalledTimes(3)
		await syncs.mock.results[2].value

		expect(sentIds('deployments')).toEqual([['dep-1']])
		expect(op('dep1').status).toBe('synced')
		expect(pulls()).toBe(2)
	})

	it('syncs once more, not once per request', async () => {
		const release = holdNextPull()
		const syncs = jest.spyOn(SupabaseSyncService, 'sync')

		const running = SupabaseSyncService.sync()
		await settle(() => pulls() === 1)
		queueDeployment()
		SupabaseSyncService.requestSync()
		SupabaseSyncService.requestSync()
		SupabaseSyncService.debouncedSync()
		jest.runOnlyPendingTimers()
		await settle()

		release()
		await running
		await syncs.mock.results[syncs.mock.results.length - 1].value
		await settle()

		expect(pulls()).toBe(2)
		expect(sentIds('deployments')).toEqual([['dep-1']])
		expect(service.syncAgain).toBe(false)
	})

	it('does nothing offline, and leaves nothing behind to run later', async () => {
		goOffline()
		queueDeployment()

		SupabaseSyncService.requestSync()
		await settle()

		expect(mockGetUser).not.toHaveBeenCalled()
		expect(mockRpc).not.toHaveBeenCalled()
		expect(op('dep1').status).toBe('pending')
		expect(service.syncAgain).toBe(false)
	})

	it('does not sync again when the phone went offline before the running sync ended', async () => {
		const release = holdNextPull()
		const syncs = jest.spyOn(SupabaseSyncService, 'sync')

		const running = SupabaseSyncService.sync()
		await settle(() => pulls() === 1)
		queueDeployment()
		SupabaseSyncService.requestSync()
		await settle()
		goOffline()

		release()
		await running
		await expect(syncs.mock.results[2].value).resolves.toBeUndefined()

		expect(pulls()).toBe(1)
		expect(op('dep1').status).toBe('pending')
		expect(service.syncAgain).toBe(false)
	})

	it('runs a sync turned away by the in-progress flag of a killed run once start-up clears it', async () => {
		;(SyncStateService.isSyncInProgress as jest.Mock).mockResolvedValueOnce(true)
		queueDeployment()

		await SupabaseSyncService.sync()
		expect(pulls()).toBe(0)

		const syncs = jest.spyOn(SupabaseSyncService, 'sync')
		await SupabaseSyncService.resetSyncState()
		expect(syncs).toHaveBeenCalledTimes(1)
		await syncs.mock.results[0].value

		expect(pulls()).toBe(1)
		expect(op('dep1').status).toBe('synced')
	})
})

describe('a deployment edited on the website (#411)', () => {
	const seedOldCopy = () => seedRows('deployments', [{
		id: 'dep-1',
		projectId: 'project-1',
		deviceId: 'device-1',
		name: 'Ridge',
		setupBy: USER_B,
		deploymentStart: new Date('2026-10-01T00:00:00Z'),
		deploymentEnd: null,
		deploymentStatusId: DEPLOYMENT_STATUS.STARTED,
		// The website has since moved the site; this phone has not pulled it
		locationName: 'Old site',
		latitude: -41.29,
		longitude: 174.78,
		cameraLocationImagePaths: [],
		createdAt: Date.parse('2026-10-01T00:00:00Z'),
		updatedAt: Date.parse('2026-10-01T00:00:00Z'),
	}])

	it('an end made on a phone holding the old location pushes no location', async () => {
		seedOldCopy()
		serverRows.projects = [{ id: 'project-1' }]
		jest.spyOn(SupabaseSyncService, 'requestSync').mockImplementation(() => {})

		await DeploymentService.endDeployment('dep-1', USER_B, 'Retrieved')
		await service.uploadOutbox(USER_B)

		const [sent] = pushCalls[0].deployments.updated
		expect(sent).toEqual(expect.objectContaining({ id: 'dep-1', deployment_status_id: DEPLOYMENT_STATUS.ENDED }))
		for (const column of ['location_name', 'latitude', 'longitude', 'project_id', 'setup_by']) {
			expect(sent).not.toHaveProperty(column)
		}
	})

	// The outbox does not merge: each change goes up as its own row, in the
	// order made, and push_changes applies them in the order sent
	it('sends two changes to one deployment oldest first, each with only its own columns', async () => {
		serverRows.projects = [{ id: 'project-1' }]
		seedRows('deployments', [{ id: 'dep-1', projectId: 'project-1' }])
		queue({ id: 'photos', table: 'deployments', type: 'UPDATE', recordId: 'dep-1', userId: USER_B, clock: 2000,
			payload: { camera_location_image_paths: ['project-1/dep-1/a.jpg'] } })
		queue({ id: 'end', table: 'deployments', type: 'UPDATE', recordId: 'dep-1', userId: USER_B, clock: 1000,
			payload: { deployment_status_id: DEPLOYMENT_STATUS.ENDED } })

		await service.uploadOutbox(USER_B)

		const sent = pushCalls[0].deployments.updated
		expect(sent.map((row: any) => row.operation_id)).toEqual(['op-end', 'op-photos'])
		expect(sent[0]).not.toHaveProperty('camera_location_image_paths')
		expect(sent[1]).not.toHaveProperty('deployment_status_id')
	})

	it('still holds an update whose project the server no longer has, by the project on the phone', async () => {
		seedRows('deployments', [{ id: 'dep-1', projectId: 'project-gone' }])
		queue({ id: 'end', table: 'deployments', type: 'UPDATE', recordId: 'dep-1', userId: USER_B,
			payload: { deployment_status_id: DEPLOYMENT_STATUS.ENDED } })

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('deployments: 1 waiting')

		expect(sentIds('deployments')).toEqual([])
		expect(op('end').status).toBe('pending')
	})
})

describe('deletions pull_changes lists (#411)', () => {
	const sync = () => SupabaseSyncService.sync().catch(() => {})
	const ids = (table: string) => rowsIn(table).map((r) => r.id).sort()
	const deployment = (id: string) => rowsIn('deployments').find((d) => d.id === id)

	beforeEach(() => {
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_B)
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: true } }),
			dispatch: jest.fn(),
		})
		serverRows.projects = [{ id: 'project-1' }]
		seedRows('projects', [{ id: 'project-1', name: 'Ridge survey' }])
	})

	it('removes a deployment deleted on the server or moved away, and a listed device nothing uses', async () => {
		seedRows('deployments', [
			{ id: 'dep-gone', projectId: 'project-1', deviceId: 'device-gone', cameraLocationImagePaths: [] },
			{ id: 'dep-stays', projectId: 'project-1', deviceId: 'device-shared', cameraLocationImagePaths: [] },
		])
		seedRows('devices', [{ id: 'device-gone' }, { id: 'device-shared' }])
		pullChanges = {
			deployments: { created: [], updated: [], deleted: ['dep-gone', 'never-on-this-phone'] },
			devices: { created: [], updated: [], deleted: ['device-gone', 'device-shared'] },
		}

		await sync()

		expect(ids('deployments')).toEqual(['dep-stays'])
		// Still the camera of a deployment on the phone
		expect(ids('devices')).toEqual(['device-shared'])
		expect(state.get(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)).toBe('1000')
	})

	it('keeps a deployment with a change not yet uploaded, orphans the change and stops sending it', async () => {
		seedRows('deployments', [{ id: 'dep-ended', name: 'Ridge 2', projectId: 'project-1', deviceId: 'device-1', cameraLocationImagePaths: [] }])
		seedRows('devices', [{ id: 'device-1' }])
		queue({ id: 'end', table: 'deployments', type: 'UPDATE', recordId: 'dep-ended', userId: USER_B, status: 'failed',
			payload: { deployment_status_id: DEPLOYMENT_STATUS.ENDED } })
		// The server has it no more, so the push this sync makes cannot land
		pushHandler = () => ({ data: { processed: 0, conflicts: [{ id: 'dep-ended', reason: 'not_applied' }] }, error: null })
		pullChanges = {
			deployments: { deleted: ['dep-ended'] },
			devices: { deleted: ['device-1'] },
		}

		await sync()

		expect(ids('deployments')).toEqual(['dep-ended'])
		expect(deployment('dep-ended')!.customSyncStatus).toBe(GONE_FROM_SERVER)
		expect(ids('devices')).toEqual(['device-1'])
		expect(op('end').status).toBe('orphaned')
		expect(op('end').errorMessage).toContain('"Ridge 2" (dep-ended) was deleted on the server, or moved out')

		pushCalls.length = 0
		pullChanges = {}
		await expect(SupabaseSyncService.sync()).resolves.toBeUndefined()
		expect(pushCalls).toHaveLength(0)
		expect(op('end').status).toBe('orphaned')
	})

	it('keeps a deployment whose site photo is still only on the phone', async () => {
		seedRows('deployments', [{ id: 'dep-photo', projectId: 'project-1', deviceId: 'device-1',
			cameraLocationImagePaths: ['file:///data/deployment-photos/1.jpg'] }])
		pullChanges = { deployments: { deleted: ['dep-photo'] } }

		await sync()

		expect(deployment('dep-photo')!.customSyncStatus).toBe(GONE_FROM_SERVER)
	})

	it('orphans a change made later to a kept deployment, and the reconcile does not queue its work again', async () => {
		seedRows('deployments', [{ id: 'dep-kept', projectId: 'project-1', deviceId: 'device-1', customSyncStatus: GONE_FROM_SERVER }])
		queue({ id: 'earlier', table: 'deployments', type: 'UPDATE', recordId: 'dep-kept', userId: USER_B, status: 'orphaned' })
		queue({ id: 'later', table: 'deployments', type: 'UPDATE', recordId: 'dep-kept', userId: USER_B,
			payload: { deployment_status_id: DEPLOYMENT_STATUS.ENDED } })

		await expect(SupabaseSyncService.sync()).resolves.toBeUndefined()

		expect(sentIds('deployments')).toEqual([])
		expect(op('later').status).toBe('orphaned')
		// Its project is still on the server, which would put #330's orphans back
		expect(op('earlier').status).toBe('orphaned')
	})

	it('leaves another account\'s held change to that account, and keeps the deployment for it', async () => {
		seedRows('deployments', [{ id: 'dep-a', projectId: 'project-1', deviceId: 'device-1', cameraLocationImagePaths: [] }])
		queue({ id: 'a-end', table: 'deployments', type: 'UPDATE', recordId: 'dep-a', userId: USER_A })
		pullChanges = { deployments: { deleted: ['dep-a'] } }

		await sync()

		expect(ids('deployments')).toEqual(['dep-a'])
		expect(op('a-end').status).toBe('pending')
	})

	it('takes a kept deployment back when the server sends it again, and queues its work again', async () => {
		seedRows('deployments', [{ id: 'dep-back', projectId: 'project-1', deviceId: 'device-1',
			deploymentStatusId: DEPLOYMENT_STATUS.ENDED, customSyncStatus: GONE_FROM_SERVER }])
		queue({ id: 'end', table: 'deployments', type: 'UPDATE', recordId: 'dep-back', userId: USER_B, status: 'orphaned' })
		// Moved back: the move bumps updated_at, so the deployment pull brings it
		pullRows.deployments = [{ id: 'dep-back', project_id: 'project-1', device_id: 'device-1',
			deployment_status_id: DEPLOYMENT_STATUS.STARTED, updated_at: '2026-10-08T00:00:00Z' }]

		await service.syncDeployments()

		expect(deployment('dep-back')!.customSyncStatus).toBeUndefined()
		expect(op('end').status).toBe('pending')
		// The end still to push is newer than the server's row
		expect(deployment('dep-back')!.deploymentStatusId).toBe(DEPLOYMENT_STATUS.ENDED)
	})

	it('keeps the watermark when the deletions cannot be applied, so the next pull lists them again', async () => {
		const apply = jest.spyOn(service, 'applyServerDeletions').mockRejectedValueOnce(new Error('database is locked'))
		pullChanges = { deployments: { deleted: ['dep-1'] } }

		await sync()

		expect(apply).toHaveBeenCalled()
		expect(state.has(SYNC_STATE_KEYS.LAST_PULL_TIMESTAMP)).toBe(false)
		apply.mockRestore()
	})
})

describe('a deployment whose device is not on the phone (#411)', () => {
	beforeEach(() => {
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_B)
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: true } }),
			dispatch: jest.fn(),
		})
		serverRows.projects = [{ id: 'project-1' }]
		seedRows('projects', [{ id: 'project-1', name: 'Ridge survey' }])
	})

	const movedIn = { id: 'dep-moved', project_id: 'project-1', device_id: 'device-moved', name: 'From the valley',
		deployment_start: '2026-09-20T00:00:00Z', created_at: '2026-09-20T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }
	const itsDevice = { id: 'device-moved', bluetooth_id: 'D4:5E', name: 'WILD-MOVE', organisation_id: 'org-1',
		created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }

	it('fetches the device by id after the deployment pull', async () => {
		pullRows.deployments = [movedIn]
		// The incremental device pull did not bring it
		serverRows.devices = [itsDevice]

		await SupabaseSyncService.sync()

		expect(readById.devices).toEqual([['device-moved']])
		expect(rowsIn('devices')).toEqual([expect.objectContaining({ id: 'device-moved', name: 'WILD-MOVE', bluetoothId: 'D4:5E' })])
	})

	it('asks for nothing when every deployment has its device', async () => {
		pullRows.deployments = [movedIn]
		pullRows.devices = [{ ...itsDevice, updated_at: '2026-10-08T00:00:00Z' }]

		await SupabaseSyncService.sync()

		expect(readById.devices).toBeUndefined()
		expect(rowsIn('devices').map((d) => d.id)).toEqual(['device-moved'])
	})

	it('only logs a failed fetch, and the sync completes', async () => {
		pullRows.deployments = [movedIn]
		readErrors.devices = { message: 'Network request failed' }

		await expect(SupabaseSyncService.sync()).resolves.toBeUndefined()

		expect(rowsIn('deployments').map((d) => d.id)).toEqual(['dep-moved'])
		expect(rowsIn('devices')).toEqual([])
	})
})
