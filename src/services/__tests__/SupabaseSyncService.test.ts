/**
 * The push half of a sync (#287), the account a sync runs as (#267), projects
 * that disappear from the server (#330), deployments edited, deleted or moved
 * on the website (#411), the start snapshot a pulled deployment carries
 * (#426), changes the server refuses for good (#449), and a camera the server
 * has under another id (#451).
 *
 * The database is an in-memory fake, so these assert on what each outbox
 * operation ends up as, and on what push_changes was actually sent.
 */
import SupabaseSyncService from '../SupabaseSyncService'
import SyncStateService, { SYNC_STATE_KEYS, PULL_WATERMARK_KEYS } from '../SyncStateService'
import OutboxService from '../OutboxService'
import ProjectService from '../ProjectService'
import { DeploymentService, DEPLOYMENT_STATUS, mapModelToPayload } from '../DeploymentService'
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
jest.mock('../OfflinePrefetchService', () => ({ __esModule: true, default: { request: jest.fn() } }))

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
// Decides what push_changes answers for one call's `changes`, with the HTTP
// status postgrest-js reports beside them when it matters
let pushHandler: (changes: any) => { data?: any, error?: any, status?: number }
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
		// Refused on its own in the record-by-record retry, so for good (#449)
		expect(op('d-new').status).toBe('refused')
		expect(op('d-new').errorMessage).toContain('42501 new row violates row-level security')
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

	// Postgres checks the INSERT policy before ON CONFLICT, so a camera's CREATE
	// re-sent by someone outside its organisation is refused although the row
	// is there; deployment starts queued one each until #451
	it('marks a device CREATE refused 42501 synced when the server already shows the device', async () => {
		queue({ id: 'd1', table: 'devices', type: 'CREATE', recordId: 'device-1', userId: USER_B })
		queue({ id: 'd1-copy', table: 'devices', type: 'CREATE', recordId: 'device-1', userId: USER_B, status: 'failed' })
		queue({ id: 'dep1', table: 'deployments', type: 'CREATE', recordId: 'dep-1', userId: USER_B,
			payload: { project_id: 'project-1', device_id: 'device-1' } })
		serverRows.devices = [{ id: 'device-1' }]
		serverRows.projects = [{ id: 'project-1' }]
		pushHandler = (changes) => changes.devices.created.length > 0
			? { data: null, error: { code: '42501', message: 'refused' }, status: 403 }
			: { data: { processed: 1, conflicts: [] }, error: null }

		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()

		expect(op('d1').status).toBe('synced')
		expect(op('d1').errorMessage).toContain('already on the server')
		expect(op('d1-copy').status).toBe('synced')
		expect(op('dep1').status).toBe('synced')

		pushCalls.length = 0
		await service.uploadOutbox(USER_B)
		expect(pushCalls).toHaveLength(0)
	})

	it('asks again next sync when it cannot ask the server about a device refused 42501', async () => {
		queue({ id: 'd1', table: 'devices', type: 'CREATE', recordId: 'device-1', userId: USER_B })
		serverRows.devices = [{ id: 'device-1' }]
		pushHandler = (changes) => changes.devices.created.length > 0
			? { data: null, error: { code: '42501', message: 'refused' }, status: 403 }
			: { data: { processed: 1, conflicts: [] }, error: null }
		readErrors.devices = { message: 'TypeError: Network request failed' }

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('devices: 1 refused by the server (42501 refused)')
		expect(op('d1').status).toBe('failed')

		delete readErrors.devices
		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()
		expect(op('d1').status).toBe('synced')
	})

	// ww-backend #266: an end or edit by a creator since made a viewer
	it('keeps an update or delete the server did not apply as refused, never synced and never sent again', async () => {
		queue({ id: 'u1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B })
		queue({ id: 'c1', table: 'projects', type: 'CREATE', recordId: 'project-2', userId: USER_B })
		queue({ id: 'x1', table: 'projects', type: 'DELETE', recordId: 'project-3', userId: USER_B })
		pushHandler = () => ({
			data: { processed: 0, conflicts: ['project-1', 'project-2', 'project-3'].map((id) => ({ id, reason: 'not_applied' })) },
			error: null,
		})

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('projects: 1 saved, 2 not applied by the server')

		expect(op('u1').status).toBe('refused')
		expect(op('u1').errorMessage).toContain('not_applied')
		expect(op('x1').status).toBe('refused')
		// A CREATE the server skipped is a row it already has
		expect(op('c1').status).toBe('synced')

		pushCalls.length = 0
		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()
		expect(pushCalls).toHaveLength(0)
	})

	// The reply names rows, not operations: here the entry is the CREATE's, a
	// row already there because an earlier reply was lost after the commit
	it('sends an update again on its own when it went up with its record\'s CREATE', async () => {
		queue({ id: 'c1', table: 'projects', type: 'CREATE', recordId: 'project-1', userId: USER_B, clock: 1 })
		queue({ id: 'u1', table: 'projects', type: 'UPDATE', recordId: 'project-1', userId: USER_B, clock: 2 })
		pushHandler = () => ({ data: { processed: 1, conflicts: [{ id: 'project-1', reason: 'not_applied' }] }, error: null })

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('not applied by the server')
		expect(op('c1').status).toBe('synced')
		expect(op('u1').status).toBe('failed')

		pushHandler = () => ({ data: { processed: 1, conflicts: [] }, error: null })
		await service.uploadOutbox(USER_B)
		expect(sentIds('projects')).toEqual([['project-1', 'project-1'], ['project-1']])
		expect(op('u1').status).toBe('synced')
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

		expect(op('d1').status).toBe('refused')
		expect(mockFrom).toHaveBeenCalledWith('user_roles')
		expect(pulledSince.deployments).toBeDefined()
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync/markInitialSyncComplete' }))
		expect(state.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)).toContain('devices: 1 refused by the server')
	})
})

describe('changes the server refuses for good (#449)', () => {
	const DEVICE = '84004dec-d50b-429b-81c1-9bcce300b467'
	// The camera already has an open deployment on the server (ww-backend #324).
	// The constraint is checked at commit, so the error is the whole call's.
	const secondOpenDeployment = {
		code: '23P01',
		message: 'conflicting key value violates exclusion constraint "deployments_one_open_per_device"',
		details: `Key (device_id)=(${DEVICE}) conflicts with existing key (device_id)=(${DEVICE}).`,
		hint: null,
	}
	const rlsRefusal = {
		code: '42501',
		message: 'new row violates row-level security policy for table "deployments"',
		details: null,
		hint: null,
	}
	const queueDeployment = (id: string, deviceId: string) => queue({ id, table: 'deployments', type: 'CREATE',
		recordId: `dep-${id}`, userId: USER_B, payload: { project_id: 'project-1', device_id: deviceId } })
	/** A server that refuses any call carrying this deployment, and takes the rest */
	const refusing = (refusedId: string, error: any, status: number) => (changes: any) =>
		changes.deployments.created.some((row: any) => row.id === refusedId)
			? { data: null, error, status }
			: { data: { processed: changes.deployments.created.length, conflicts: [] }, error: null, status: 200 }

	beforeEach(() => {
		serverRows.projects = [{ id: 'project-1' }]
		serverRows.devices = [{ id: DEVICE }, { id: 'device-2' }]
	})

	it('marks a 23P01 on the record-by-record retry refused, lands the rest, and never sends it again', async () => {
		queueDeployment('a', DEVICE)
		queueDeployment('b', 'device-2')
		pushHandler = refusing('dep-a', secondOpenDeployment, 409)

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('deployments: 1 saved, 1 refused by the server (23P01')

		expect(sentIds('deployments')).toEqual([['dep-a', 'dep-b'], ['dep-a'], ['dep-b']])
		expect(op('a').status).toBe('refused')
		expect(op('a').errorMessage).toBe('23P01 conflicting key value violates exclusion constraint "deployments_one_open_per_device"')
		expect(op('b').status).toBe('synced')

		pushCalls.length = 0
		queueDeployment('c', 'device-2')
		await service.uploadOutbox(USER_B)
		expect(sentIds('deployments')).toEqual([['dep-c']])
		expect(op('a').status).toBe('refused')
	})

	it('marks a 42501 refused when it is the only record sent, in one call', async () => {
		queueDeployment('a', DEVICE)
		pushHandler = refusing('dep-a', rlsRefusal, 403)

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('deployments: 1 refused by the server (42501')

		expect(sentIds('deployments')).toEqual([['dep-a']])
		expect(op('a').status).toBe('refused')
		expect(op('a').errorMessage).toContain('42501 new row violates row-level security policy')
		expect((await OutboxService.getStatistics()).refused).toBe(1)

		pushCalls.length = 0
		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()
		expect(pushCalls).toHaveLength(0)
	})

	// As postgrest-js returns each: a failed fetch comes back as an error with
	// an empty code and status 0, not as a throw
	it.each([
		['the request never got there', { message: 'TypeError: Network request failed', details: '', hint: '', code: '' }, 0],
		['a gateway error', { message: '<html><body>502 Bad Gateway</body></html>' }, 502],
		['a statement timeout', { code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, 500],
		['an expired token', { code: 'PGRST303', message: 'JWT expired', details: null, hint: null }, 401],
		['a call made with no signed-in user', { code: '42501', message: 'permission denied for function push_changes', details: null, hint: null }, 401],
	])('keeps retrying when it is %s', async (_case, error, status) => {
		queueDeployment('a', DEVICE)
		queueDeployment('b', 'device-2')
		pushHandler = () => ({ data: null, error, status })

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('Push incomplete')
		expect(op('a').status).toBe('failed')
		expect(op('b').status).toBe('failed')

		pushHandler = () => ({ data: { processed: 2, conflicts: [] }, error: null, status: 200 })
		await service.uploadOutbox(USER_B)
		expect(op('a').status).toBe('synced')
		expect(op('b').status).toBe('synced')
	})

	it('still uploads site photos and asks for the field downloads when the push fails', async () => {
		const { DeploymentPhotoService } = require('../DeploymentPhotoService')
		const OfflinePrefetchService = require('../OfflinePrefetchService').default
		state.set(SYNC_STATE_KEYS.LAST_SYNC_USER_ID, USER_B)
		SupabaseSyncService.setStore({
			getState: () => ({ network: { isOnline: true }, sync: { hasCompletedInitialSync: true } }),
			dispatch: jest.fn(),
		})
		queueDeployment('a', DEVICE)
		pushHandler = () => ({ data: null, error: { message: 'TypeError: Network request failed', details: '', hint: '', code: '' }, status: 0 })

		await expect(SupabaseSyncService.sync()).rejects.toThrow('deployments: 1 not sent')

		expect(DeploymentPhotoService.uploadAllPending).toHaveBeenCalledWith(USER_B)
		expect(OfflinePrefetchService.request).toHaveBeenCalledWith('sync')
		expect(state.get(SYNC_STATE_KEYS.LAST_SYNC_ERROR)).toContain('deployments: 1 not sent')
	})

	it('keeps a project whose CREATE the server refused, and its creator\'s role', async () => {
		seedRows('projects', [{ id: 'project-1', name: 'On the server' }, { id: 'project-refused', name: 'Not my organisation' }])
		seedRows('user_roles', [{ id: 'creator', userId: USER_B, role: 'project_admin', scopeType: 'project', scopeId: 'project-refused', isActive: true }])
		queue({ id: 'create', table: 'projects', type: 'CREATE', recordId: 'project-refused', userId: USER_B, status: 'refused' })
		serverRows.user_roles = [{ id: 'member', user_id: USER_B, role: 'organisation_member', scope_type: 'organisation',
			scope_id: 'org-1', is_active: true, updated_at: '2026-10-01T00:00:00Z' }]

		await service.reconcileProjects(USER_B)
		await service.syncUserRoles(USER_B)

		expect(rowsIn('projects').map((p) => p.id)).toContain('project-refused')
		expect(rowsIn('user_roles').map((r) => r.id).sort()).toEqual(['creator', 'member'])
		expect(op('create').status).toBe('refused')
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

describe('a deployment pulled onto another phone (#426)', () => {
	// The camera as the phone that started the deployment recorded it
	const snapshot = {
		cameraModel: 'WW500',
		lorawanNetwork: 'TTN',
		deviceEui: '70B3D57ED0065A2B',
		lorawanRegistrationCompleted: true,
		lorawanLastVerifiedAt: new Date('2026-10-01T02:55:00Z'),
		aiModelId: 'model-1',
		bleFirmwareId: 'ble-firmware-1',
		himaxFirmwareId: 'himax-firmware-1',
		batteryLevelAtStart: 87,
		sdCardTotalKbAtStart: 31166976,
		sdCardAvailableKbAtStart: 30932992,
		lorawanRssiAtStart: -97,
		lorawanSnrAtStart: 7.5,
	}

	// The server's row is the starting phone's CREATE: push_changes stores the
	// snapshot as sent and never updates it
	const serverRow = () => mapModelToPayload({
		id: 'dep-1',
		projectId: 'project-1',
		deviceId: 'device-1',
		name: 'Ridge',
		setupBy: USER_A,
		deploymentStart: new Date('2026-10-01T03:00:00Z'),
		deploymentStatusId: DEPLOYMENT_STATUS.STARTED,
		locationName: 'Ridge top',
		cameraLocationImagePaths: [],
		createdAt: Date.parse('2026-10-01T03:00:00Z'),
		updatedAt: Date.parse('2026-10-01T03:00:00Z'),
		...snapshot,
	} as any)

	it('arrives on a phone that never had it with the snapshot the starting phone sent', async () => {
		pullRows.deployments = [serverRow()]

		await service.syncDeployments()

		expect(rowsIn('deployments')).toEqual([expect.objectContaining({ id: 'dep-1', ...snapshot })])
	})

	it('fills in the empty snapshot an earlier pull left on this phone', async () => {
		seedRows('deployments', [{ id: 'dep-1', projectId: 'project-1', deviceId: 'device-1', name: 'Ridge',
			lorawanRegistrationCompleted: false, lorawanLastVerifiedAt: null }])
		pullRows.deployments = [serverRow()]

		await service.syncDeployments()

		expect(rowsIn('deployments')).toEqual([expect.objectContaining({ id: 'dep-1', ...snapshot })])
	})

	// What a phone on 0.0.69 left on a server that still let an update set the
	// snapshot, when it ended a deployment it had pulled with none
	const lostOnServer = () => ({
		...serverRow(),
		camera_model: null, lorawan_network: null, device_eui: null,
		lorawan_registration_completed: false, lorawan_last_verified_at: null,
		ai_model_id: null, ble_firmware_id: null, himax_firmware_id: null,
		battery_level_at_start: null, sd_card_total_kb_at_start: null, sd_card_available_kb_at_start: null,
		lorawan_rssi_at_start: null, lorawan_snr_at_start: null,
		deployment_status_id: DEPLOYMENT_STATUS.ENDED,
	})

	it('keeps the snapshot this phone holds when the server row has lost it, and applies the rest', async () => {
		seedRows('deployments', [{ id: 'dep-1', projectId: 'project-1', deviceId: 'device-1', name: 'Ridge',
			deploymentStatusId: DEPLOYMENT_STATUS.STARTED, ...snapshot }])
		pullRows.deployments = [lostOnServer()]

		await service.syncDeployments()

		expect(rowsIn('deployments')).toEqual([expect.objectContaining({
			id: 'dep-1', deploymentStatusId: DEPLOYMENT_STATUS.ENDED, ...snapshot })])
	})
})

describe('a camera the server has under another id (#451)', () => {
	const LOCAL = 'device-local'
	const SERVER = 'device-server'
	// devices.bluetooth_id is unique, as a column constraint and an index, and
	// push_changes inserts a device ON CONFLICT (id) only
	const bluetoothIdTaken = {
		code: '23505',
		message: 'duplicate key value violates unique constraint "devices_bluetooth_id_key"',
		details: 'Key (bluetooth_id)=(D4:5E) already exists.',
		hint: null,
	}
	const serverDevice = { id: SERVER, bluetooth_id: 'D4:5E', name: 'WILD-MOVE', organisation_id: 'org-other',
		device_eui: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }

	beforeEach(() => {
		serverRows.projects = [{ id: 'project-1' }]
		// The phone's own registration of a camera the server already has
		seedRows('devices', [{ id: LOCAL, bluetoothId: 'D4:5E', name: 'WILD-MOVE', organisationId: 'org-1' }])
		seedRows('deployments', [{ id: 'dep-1', projectId: 'project-1', deviceId: LOCAL }])
		queue({ id: 'd1', table: 'devices', type: 'CREATE', recordId: LOCAL, userId: USER_B,
			payload: { bluetooth_id: 'D4:5E', name: 'WILD-MOVE', organisation_id: 'org-1' } })
		queue({ id: 'dep1', table: 'deployments', type: 'CREATE', recordId: 'dep-1', userId: USER_B,
			payload: { project_id: 'project-1', device_id: LOCAL } })
		pushHandler = (changes) => {
			if (changes.devices.created.some((row: any) => row.id === LOCAL)) {
				return { data: null, error: bluetoothIdTaken, status: 409 }
			}
			if (changes.deployments.created.some((row: any) => row.device_id === LOCAL)) {
				return { data: null, status: 409, error: {
					code: '23503', message: 'insert or update on table "deployments" violates foreign key constraint "deployments_device_id_fkey"' } }
			}
			return { data: { processed: 1, conflicts: [] }, error: null, status: 200 }
		}
	})

	const sentDeviceIds = () => pushCalls.flatMap((changes) => changes.deployments.created.map((row: any) => row.device_id))

	it("takes the server's row when this account may read it, and sends the deployments with its id in the same push", async () => {
		serverRows.devices = [serverDevice]
		// Changes queued earlier keep their status: a refused deployment was refused for its own reason
		queue({ id: 'dep2', table: 'deployments', type: 'CREATE', recordId: 'dep-2', userId: USER_B, status: 'refused',
			payload: { project_id: 'project-1', device_id: LOCAL } })
		queue({ id: 'other', table: 'deployments', type: 'CREATE', recordId: 'dep-3', userId: USER_B, status: 'refused',
			payload: { project_id: 'project-1', device_id: 'device-else' } })

		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()

		expect(op('d1').status).toBe('synced')
		expect(op('d1').errorMessage).toContain(`replaced: the server already has this camera as ${SERVER}`)
		expect(rowsIn('devices')).toEqual([expect.objectContaining({ id: SERVER, bluetoothId: 'D4:5E', organisationId: 'org-other' })])
		expect(rowsIn('deployments')).toEqual([expect.objectContaining({ id: 'dep-1', deviceId: SERVER })])
		expect(JSON.parse(op('dep2').payload).device_id).toBe(SERVER)
		expect(op('dep2').status).toBe('refused')
		expect(JSON.parse(op('other').payload).device_id).toBe('device-else')

		expect(sentIds('devices')).toEqual([[LOCAL]])
		expect(sentDeviceIds()).toEqual([SERVER])
		expect(op('dep1').status).toBe('synced')
		// Nothing about the camera is sent again
		pushCalls.length = 0
		await service.uploadOutbox(USER_B)
		expect(pushCalls).toHaveLength(0)
	})

	it('settles it on the record-by-record retry when other cameras went up with it', async () => {
		serverRows.devices = [serverDevice]
		seedRows('devices', [{ id: 'device-new', bluetoothId: 'AA:01', name: 'WILD-NEW', organisationId: 'org-1' }])
		queue({ id: 'd2', table: 'devices', type: 'CREATE', recordId: 'device-new', userId: USER_B,
			payload: { bluetooth_id: 'AA:01', name: 'WILD-NEW', organisation_id: 'org-1' } })

		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()

		expect(sentIds('devices')).toEqual([[LOCAL, 'device-new'], [LOCAL], ['device-new']])
		expect(op('d1').status).toBe('synced')
		expect(op('d2').status).toBe('synced')
		expect(rowsIn('devices').map((d) => d.id).sort()).toEqual(['device-new', SERVER])
	})

	it("refuses it for good when this account cannot read the server's row, and never sends it again", async () => {
		serverRows.devices = []

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow(
			'devices: 1 refused by the server (23505 This camera is registered on the server to an organisation this account cannot see)')

		expect(op('d1').status).toBe('refused')
		expect(op('d1').errorMessage).toBe('23505 This camera is registered on the server to an organisation this account cannot see')
		expect(rowsIn('devices').map((d) => d.id)).toEqual([LOCAL])
		// Its device never reached the server, so the deployment waits
		expect(op('dep1').status).toBe('pending')

		pushCalls.length = 0
		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('Push incomplete')
		expect(sentIds('devices')).toEqual([])
		// The 23503 self-heal does not queue a copy of the refused CREATE
		expect(rowsIn('sync_outbox').filter((o) => o.tableName === 'devices')).toHaveLength(1)
	})

	it('asks again next sync when the lookup fails', async () => {
		readErrors.devices = { message: 'TypeError: Network request failed' }

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('devices: 1 refused by the server (23505')
		expect(op('d1').status).toBe('failed')

		delete readErrors.devices
		serverRows.devices = [serverDevice]
		await expect(service.uploadOutbox(USER_B)).resolves.toBeUndefined()
		expect(op('d1').status).toBe('synced')
		expect(sentDeviceIds()).toEqual([SERVER])
	})

	it('leaves a 23505 on any other key to the retry', async () => {
		pushHandler = () => ({ data: null, status: 409, error: {
			code: '23505', message: 'duplicate key value violates unique constraint "devices_pkey"', details: `Key (id)=(${LOCAL}) already exists.` } })

		await expect(service.uploadOutbox(USER_B)).rejects.toThrow('Push incomplete')

		expect(op('d1').status).toBe('failed')
		expect(rowsIn('devices').map((d) => d.id)).toEqual([LOCAL])
	})
})

describe('a deployment start (#451)', () => {
	it('queues no device CREATE, so a camera already on the server is never sent again', async () => {
		jest.spyOn(SupabaseSyncService, 'requestSync').mockImplementation(() => {})
		serverRows.projects = [{ id: 'project-1' }]
		serverRows.devices = [{ id: 'device-1' }]
		seedRows('projects', [{ id: 'project-1', name: 'Ridge survey' }])
		const [device] = seedRows('devices', [{ id: 'device-1', bluetoothId: 'D4:5E', name: 'WILD-LENT', organisationId: 'org-other', updatedAt: 1 }])

		const deployment = await DeploymentService.createDeployment({
			name: 'Ridge 1', projectId: 'project-1', deviceId: 'device-1', setupBy: USER_B, locationName: 'Ridge',
		})

		expect(rowsIn('sync_outbox').map((o) => `${o.tableName} ${o.operationType}`)).toEqual(['deployments CREATE'])
		// Still touched, for the screens that observe it
		expect(device.updatedAt).toBeGreaterThan(1)

		await service.uploadOutbox(USER_B)
		expect(sentIds('devices')).toEqual([])
		expect(sentIds('deployments')).toEqual([[deployment.id]])
	})
})
