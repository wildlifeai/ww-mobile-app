/**
 * A camera the server has under another id (#451), against a real
 * WatermelonDB, in memory through LokiJS with the generated schema. The fake
 * database takes any batch, so it cannot show that the one write which swaps
 * the local device for the server's is one WatermelonDB accepts, nor that the
 * deployment change already read for this push carries the server's id.
 * Also how a camera the phone lacks gets its row, for the scanner and the Dev
 * Deployment Test alike, and that no deployment is saved without one (#480).
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
import { registerCamera } from '../cameraRegistration'
import type { CommandContext } from '../../ble/protocol/commandRegistry'

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
// What the server lists for this account, the camera unless a test says otherwise
let mockDevicesOnServer: any[] = []
const mockServerDevice = { id: SERVER, bluetooth_id: 'D4:5E', name: 'WILD-LENT',
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
					table === 'devices' ? { data: mockDevicesOnServer.map((row) => ({ ...row })), error: null }
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
	mockDevicesOnServer = [mockServerDevice]
	jest.spyOn(ProjectService, 'getProjectById').mockResolvedValue(null)
	jest.spyOn(SupabaseSyncService, 'requestSync').mockImplementation(() => {})
})

it("takes the server's row when the scanner asks for a camera the phone lacks", async () => {
	const result = await DeviceService.adoptFromServer('D4:5E')

	expect(result.kind).toBe('found')
	const stored = await database.get<Device>('devices').find(SERVER)
	expect(stored.bluetoothId).toBe('D4:5E')
	expect(stored.name).toBe('WILD-LENT')
	expect(await outbox('devices')).toEqual([])
})

it('swaps a local device for the server one in one write, and pushes its deployment with the server id', async () => {
	// Registered on this phone while the server could not be asked, then deployed
	const local = await DeviceService.createDevice('D4:5E', 'WILD-LENT', ME)
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

describe('registerCamera, shared by the scanner and the Dev Deployment Test (#480)', () => {
	const camera = { bluetoothId: 'D4:5E', name: 'WILD-LENT', userId: ME }

	it("takes the server's row, and queues nothing", async () => {
		const result = await registerCamera(camera)

		expect(result).toEqual({ kind: 'registered', device: expect.objectContaining({ id: SERVER }) })
		expect(await outbox('devices')).toEqual([])
	})

	// Since ww-backend #346 a camera belongs to no organisation, so a field user
	// invited to one project registers the camera in their hand (#501).
	it('creates one in no organisation, with its CREATE queued, when the server has none', async () => {
		mockDevicesOnServer = []

		const result = await registerCamera(camera)

		if (result.kind !== 'registered') throw new Error(`expected registered, got ${result.kind}`)
		expect(result.device.bluetoothId).toBe('D4:5E')
		const [create] = await outbox('devices')
		expect(create.recordId).toBe(result.device.id)
		expect(create.operationType).toBe('CREATE')
		expect(JSON.parse(create.payload)).not.toHaveProperty('organisation_id')
	})

	describe("the camera's DevEUI (#536)", () => {
		// A connected camera that answers every command with `reply`, or never
		const cameraAnswering = (reply: string | Error) => {
			const sent: string[] = []
			const session = {
				execute: async <T>(make: () => CommandContext<T>): Promise<T> => {
					const cmd = make()
					sent.push(cmd.build())
					if (reply instanceof Error) throw reply
					cmd.collect(reply)
					return cmd.parser()
				},
			}
			return { sent, session }
		}
		const createPayload = async () => JSON.parse((await outbox('devices'))[0].payload)

		beforeEach(() => { mockDevicesOnServer = [] })

		it('reads it with `get deveui` and puts it in the CREATE and on the row', async () => {
			const { sent, session } = cameraAnswering('DevEui: 70:B3:D5:7E:D0:07:00:01')

			const result = await registerCamera({ ...camera, session })

			if (result.kind !== 'registered') throw new Error(`expected registered, got ${result.kind}`)
			expect(sent).toEqual(['get deveui'])
			expect(result.device.deviceEui).toBe('70B3D57ED0070001')
			expect(await createPayload()).toEqual(expect.objectContaining({ bluetooth_id: 'D4:5E', device_eui: '70B3D57ED0070001' }))
		})

		it.each([
			['refuses it', 'Failed 2'],
			['reports all zeros', 'DevEui: 00:00:00:00:00:00:00:00'],
			// Every camera not given its own reports the firmware's default
			['reports the firmware default', 'DevEui: 00:80:E1:01:01:01:01:01'],
			['does not answer', new Error('deveui: Timeout after 3000ms')],
		])('registers the camera without one when it %s', async (_, reply) => {
			const { sent, session } = cameraAnswering(reply)

			const result = await registerCamera({ ...camera, session })

			if (result.kind !== 'registered') throw new Error(`expected registered, got ${result.kind}`)
			expect(sent).toEqual(['get deveui'])
			expect(result.device.deviceEui).toBeFalsy()
			expect((await createPayload()).device_eui).toBeNull()
		})

		it("asks nothing of a camera the server already has, and keeps the server's row as it is", async () => {
			mockDevicesOnServer = [mockServerDevice]
			const { sent, session } = cameraAnswering('DevEui: 70:B3:D5:7E:D0:07:00:01')

			const result = await registerCamera({ ...camera, session })

			expect(result).toEqual({ kind: 'registered', device: expect.objectContaining({ id: SERVER }) })
			expect(sent).toEqual([])
			expect((await database.get<Device>('devices').find(SERVER)).deviceEui).toBeFalsy()
		})
	})

	it('writes nothing when cancelled after the server lookup', async () => {
		mockDevicesOnServer = []

		const result = await registerCamera({ ...camera, isCancelled: () => true })

		expect(result).toEqual({ kind: 'cancelled' })
		expect(await database.get<Device>('devices').query().fetch()).toEqual([])
		expect(await outbox('devices')).toEqual([])
	})
})

it('refuses a deployment without a camera, and saves nothing (#480)', async () => {
	await expect(DeploymentService.createDeployment({
		name: 'Dev Deployment Test', projectId: PROJECT, deviceId: '', setupBy: ME, locationName: 'Dev Deployment Test',
	})).rejects.toThrow('This phone has no record of the camera')

	expect(await database.get<Deployment>('deployments').query().fetch()).toEqual([])
	expect(await outbox('deployments')).toEqual([])
})
