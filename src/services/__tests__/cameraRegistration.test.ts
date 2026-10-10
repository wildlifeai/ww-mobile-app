/**
 * A camera the server has under another id (#451), against a real
 * WatermelonDB, in memory through LokiJS with the generated schema. The fake
 * database takes any batch, so it cannot show that the one write which swaps
 * the local device for the server's is one WatermelonDB accepts, nor that the
 * deployment change already read for this push carries the server's id.
 */
import { Q } from '@nozbe/watermelondb'

import database from '../../database'
import type Deployment from '../../database/models/Deployment'
import type Device from '../../database/models/Device'
import type SyncOutbox from '../../database/models/SyncOutbox'
import SupabaseSyncService from '../SupabaseSyncService'
import { DeploymentService } from '../DeploymentService'
import { DeviceService } from '../DeviceService'
import ProjectService from '../ProjectService'

jest.mock('../../database', () => {
	const { Database } = require('@nozbe/watermelondb')
	const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
	require('@nozbe/watermelondb/utils/common/logger').default.silence()
	const model = (name: string) => require(`../../database/models/${name}`).default
	return {
		__esModule: true,
		default: new Database({
			adapter: new LokiJSAdapter({
				schema: require('../../database/schema').default,
				useWebWorker: false,
				useIncrementalIndexedDB: false,
				// Loki saves every 500 ms by default, which keeps Jest from exiting
				extraLokiOptions: { autosave: false },
			}),
			modelClasses: ['Deployment', 'Device', 'Project', 'ProjectInvitation', 'SyncOutbox', 'User', 'UserRole'].map(model),
		}),
	}
})
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../utils/networkErrors', () => ({ logCloudFailure: jest.fn(), isNetworkOrRetryable: jest.fn(() => true) }))

const ME = 'user-me'
const PROJECT = 'project-1'
const SERVER = 'device-server'
const mockServerDevice = { id: SERVER, bluetooth_id: 'D4:5E', name: 'WILD-LENT', organisation_id: 'org-other',
	device_eui: null, deleted_at: null, modified_by: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z' }
// Every push_changes call, and what the server answers
const mockPushes: any[] = []
const mockPush = (changes: any) => {
	if (changes.devices.created.length > 0) {
		return { data: null, status: 409, error: {
			code: '23505', message: 'duplicate key value violates unique constraint "devices_bluetooth_id_key"',
			details: 'Key (bluetooth_id)=(D4:5E) already exists.' } }
	}
	if (changes.deployments.created.some((row: any) => row.device_id !== SERVER)) {
		return { data: null, status: 409, error: { code: '23503', message: 'violates foreign key constraint "deployments_device_id_fkey"' } }
	}
	return { data: { processed: 1, conflicts: [] }, error: null, status: 200 }
}

jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		rpc: async (name: string, args: any) => {
			if (name !== 'push_changes') return { data: null, error: null }
			mockPushes.push(args.changes)
			return mockPush(args.changes)
		},
		from: (table: string) => {
			const chain: any = {
				select: () => chain,
				eq: () => chain,
				is: () => chain,
				in: () => chain,
				then: (resolve: any, reject: any) => Promise.resolve(
					table === 'devices' ? { data: [{ ...mockServerDevice }], error: null }
						: table === 'projects' ? { data: [{ id: PROJECT }], error: null }
							: { data: [], error: null },
				).then(resolve, reject),
			}
			return chain
		},
	}),
}))

const outbox = (table: string) => database.get<SyncOutbox>('sync_outbox').query(Q.where('table_name', table)).fetch()

beforeEach(async () => {
	await database.write(() => database.unsafeResetDatabase())
	mockPushes.length = 0
	jest.spyOn(ProjectService, 'getProjectById').mockResolvedValue(null)
	jest.spyOn(SupabaseSyncService, 'requestSync').mockImplementation(() => {})
})

it("takes the server's row when the scanner asks for a camera the phone lacks", async () => {
	const result = await DeviceService.adoptFromServer('D4:5E')

	expect(result.kind).toBe('found')
	const stored = await database.get<Device>('devices').find(SERVER)
	expect(stored.bluetoothId).toBe('D4:5E')
	expect(stored.organisationId).toBe('org-other')
	expect(await outbox('devices')).toEqual([])
})

it('swaps a local device for the server one in one write, and pushes its deployment with the server id', async () => {
	// Registered on this phone while the server could not be asked, then deployed
	const local = await DeviceService.createDevice('D4:5E', 'WILD-LENT', 'org-1', ME)
	const deployment = await DeploymentService.createDeployment({
		name: 'Ridge', projectId: PROJECT, deviceId: local.id, setupBy: ME, locationName: 'Ridge track',
	})

	await expect((SupabaseSyncService as any).uploadOutbox(ME)).resolves.toBeUndefined()

	const [deviceCreate] = await outbox('devices')
	expect(deviceCreate.status).toBe('synced')
	expect(deviceCreate.errorMessage).toContain(`replaced: the server already has this camera as ${SERVER}`)
	expect((await database.get<Device>('devices').query().fetch()).map((d) => d.id)).toEqual([SERVER])
	expect((await database.get<Deployment>('deployments').find(deployment.id)).deviceId).toBe(SERVER)

	const [deploymentCreate] = await outbox('deployments')
	expect(JSON.parse(deploymentCreate.payload).device_id).toBe(SERVER)
	expect(deploymentCreate.status).toBe('synced')
	expect(mockPushes.flatMap((changes) => changes.deployments.created.map((row: any) => row.device_id))).toEqual([SERVER])
})
