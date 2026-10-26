import { DeploymentService, DEPLOYMENT_STATUS } from '../DeploymentService'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

/**
 * #448: a camera has one open deployment at a time (ww-backend #324), and a
 * push that creates a second is refused with 23P01. Before a start writes to
 * the camera, the app asks the server about an open deployment this phone does
 * not hold, and stops on one; offline, or when the server cannot be asked, it
 * warns and carries on.
 */

const netInfo = require('@react-native-community/netinfo')

/** What the server answers, as this account is allowed to read it */
let mockOpen: Array<Record<string, any>> = []
let mockReadError: any = null
let mockReadHangs = false
let mockProjects: Record<string, string> = {}
let mockMembers: Array<{ id: string; name: string }> | null = null
/** What camera_open_deployment answers (ww-backend #346) */
let mockCamera: { data: any; error: any } = { data: [{ deployed: false, project_name: null }], error: null }
const mockRpc: Array<[string, any]> = []
const mockFilters: Array<[string, string, any]> = []
const mockFrom = jest.fn()

/** A PostgREST builder: chainable, and awaitable for the list */
const mockQuery = (answer: () => any) => {
	const query: any = {
		select: () => query,
		eq: (column: string, value: any) => { mockFilters.push(['eq', column, value]); return query },
		is: (column: string, value: any) => { mockFilters.push(['is', column, value]); return query },
		maybeSingle: async () => answer(),
		then: (resolve: any, reject: any) => (mockReadHangs ? new Promise(() => {}) : Promise.resolve(answer())).then(resolve, reject),
	}
	return query
}

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		from: (table: string) => {
			mockFrom(table)
			if (table === 'deployments') return mockQuery(() => ({ data: mockReadError ? null : mockOpen, error: mockReadError }))
			const id = () => mockFilters.filter(([, column]) => column === 'id').pop()?.[2]
			return mockQuery(() => ({ data: mockProjects[id()] ? { name: mockProjects[id()] } : null, error: null }))
		},
		rpc: async (name: string, args: any) => {
			mockRpc.push([name, args])
			if (name === 'camera_open_deployment') return mockCamera
			return mockMembers ? { data: mockMembers, error: null } : { data: null, error: { code: '42501', message: 'Unauthorized' } }
		},
	}),
}))
jest.mock('../SupabaseSyncService', () => ({
	__esModule: true,
	default: { requestSync: jest.fn(), debouncedSync: jest.fn() },
}))
jest.mock('../ProjectService', () => ({ __esModule: true, default: { getProjectById: jest.fn() } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const openOnServer = (fields: Record<string, any> = {}) => ({
	id: 'dep-other',
	project_id: 'project-9',
	setup_by: 'user-2',
	deployment_start: '2026-10-03T21:00:00Z',
	...fields,
})

beforeEach(() => {
	resetFakeDatabase()
	mockOpen = []
	mockReadError = null
	mockReadHangs = false
	mockProjects = { 'project-9': 'Sinbad Gully' }
	mockMembers = [{ id: 'user-2', name: 'Tui Smith' }]
	mockCamera = { data: [{ deployed: false, project_name: null }], error: null }
	mockRpc.length = 0
	mockFilters.length = 0
})
afterEach(() => netInfo.__resetNetworkState())

/**
 * #502: a deployment in a project this account is not in cannot be read, so it
 * used to look free, and only the refused push said otherwise. Since ww-backend
 * #346, camera_open_deployment says whether the camera is deployed anywhere and
 * in which project, by Bluetooth id, and nothing more.
 */
describe('DeploymentService.checkServerForOpenDeployment in a project this account cannot read (#502)', () => {
	beforeEach(() => {
		seedRows('devices', [{ id: 'device-1', bluetoothId: 'C4:2F:11:0A:9B:01' }])
	})

	it('stops, naming the project and nothing else', async () => {
		mockCamera = { data: [{ deployed: true, project_name: 'Hollyford Track' }], error: null }

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({
			kind: 'open',
			message: 'This camera is still deployed in "Hollyford Track". That deployment has to be ended before the camera can be deployed again.',
		})
		expect(mockRpc).toContainEqual(['camera_open_deployment', { p_bluetooth_id: 'C4:2F:11:0A:9B:01' }])
	})

	it('finds none when the camera is not deployed anywhere', async () => {
		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({ kind: 'none' })
	})

	it('lets through one this phone has ended, whose end is not uploaded yet', async () => {
		mockCamera = { data: [{ deployed: true, project_name: 'Hollyford Track' }], error: null }
		seedRows('deployments', [{ id: 'dep-mine', deviceId: 'device-1', deploymentStatusId: DEPLOYMENT_STATUS.ENDED }])
		seedRows('sync_outbox', [{ tableName: 'deployments', recordId: 'dep-mine', status: 'pending' }])

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({ kind: 'none' })
	})

	it('stops when the end this phone made has already reached the server', async () => {
		mockCamera = { data: [{ deployed: true, project_name: 'Hollyford Track' }], error: null }
		seedRows('deployments', [{ id: 'dep-mine', deviceId: 'device-1', deploymentStatusId: DEPLOYMENT_STATUS.ENDED }])
		seedRows('sync_outbox', [{ tableName: 'deployments', recordId: 'dep-mine', status: 'synced' }])

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('open')
	})

	it('warns when the call fails', async () => {
		mockCamera = { data: null, error: { code: '08006', message: 'TypeError: Network request failed' } }

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('unchecked')
	})

	it('carries on as before against a backend without the function', async () => {
		mockCamera = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({ kind: 'none' })
	})
})

describe('DeploymentService.checkServerForOpenDeployment (#448)', () => {
	it('stops on an open deployment the phone does not hold, naming its project and who started it', async () => {
		mockOpen = [openOnServer()]

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('open')
		expect(result.kind === 'open' && result.message).toContain('"Sinbad Gully"')
		expect(result.kind === 'open' && result.message).toContain('started by Tui Smith on ')
		// The camera's open deployments, as the constraint counts them
		expect(mockFilters).toEqual(expect.arrayContaining([
			['eq', 'device_id', 'device-1'],
			['is', 'deployment_end', null],
			['is', 'deleted_at', null],
		]))
	})

	it('says "you" for one this account started, on another phone', async () => {
		mockOpen = [openOnServer({ setup_by: 'user-1' })]

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind === 'open' && result.message).toContain('started by you on ')
	})

	it('still stops when the server will not say who started it', async () => {
		mockOpen = [openOnServer()]
		mockMembers = null

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('open')
		expect(result.kind === 'open' && result.message).toMatch(/"Sinbad Gully", started on /)
	})

	it('finds none when the server has none this account can see', async () => {
		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({ kind: 'none' })
	})

	it('lets through one this phone has ended, whose end is not uploaded yet', async () => {
		mockOpen = [openOnServer({ id: 'dep-mine', setup_by: 'user-1' })]
		seedRows('deployments', [{ id: 'dep-mine', deviceId: 'device-1', deploymentStatusId: DEPLOYMENT_STATUS.ENDED }])

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result).toEqual({ kind: 'none' })
	})

	it('stops on one this phone holds but has not ended', async () => {
		mockOpen = [openOnServer({ id: 'dep-mine', setup_by: 'user-1' })]
		seedRows('deployments', [{ id: 'dep-mine', deviceId: 'device-1', deploymentStatusId: DEPLOYMENT_STATUS.STARTED }])

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('open')
	})

	it('offline, warns without asking the server', async () => {
		netInfo.__setNetworkState({ isConnected: false })

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('unchecked')
		expect(result.kind === 'unchecked' && result.message).toMatch(/server will refuse this deployment/)
		expect(mockFrom).not.toHaveBeenCalled()
	})

	it('warns when the read fails', async () => {
		mockReadError = { message: 'TypeError: Network request failed' }

		const result = await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(result.kind).toBe('unchecked')
	})

	it('does not ask about other projects when it can read the open one', async () => {
		mockOpen = [openOnServer()]
		seedRows('devices', [{ id: 'device-1', bluetoothId: 'C4:2F:11:0A:9B:01' }])

		await DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')

		expect(mockRpc.map(([name]) => name)).not.toContain('camera_open_deployment')
	})

	it('warns when the server does not answer in time', async () => {
		mockReadHangs = true

		const pending = DeploymentService.checkServerForOpenDeployment('device-1', 'user-1')
		await jest.advanceTimersByTimeAsync(10_000)

		expect((await pending).kind).toBe('unchecked')
	})
})
