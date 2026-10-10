import { DeploymentService, DEPLOYMENT_STATUS } from '../DeploymentService'
import { DeploymentPhotoService } from '../DeploymentPhotoService'
import { resetFakeDatabase, seedRows, rowsIn } from '../../../tests/setup/helpers/fakeDatabase'

/**
 * #411: the website can now correct a deployment's location. Ending the
 * deployment, or swapping in a photo's bucket path, sent the whole record, and
 * the push runs before the pull, so a phone holding the old copy put the old
 * location_name, latitude and longitude back over the website's edit. An
 * update now carries only the columns it changed.
 */

const LOCAL = 'file:///docs/deployment-photos/1-a.jpeg'
const mockFiles = new Set<string>()

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('expo-file-system/legacy', () => ({
	documentDirectory: 'file:///docs/',
	EncodingType: { Base64: 'base64' },
	getInfoAsync: jest.fn(async (path: string) => ({ exists: mockFiles.has(path) })),
	readAsStringAsync: jest.fn(async () => 'AAAA'),
	deleteAsync: jest.fn(async (path: string) => { mockFiles.delete(path) }),
}))
jest.mock('../supabase', () => ({
	getSupabaseClient: () => ({
		storage: { from: () => ({ upload: jest.fn(async () => ({ error: null })), list: jest.fn() }) },
	}),
}))
// The uploader may change the deployment; the role rule is tested in deploymentAccess.test.ts (#467)
jest.mock('../deploymentAccess', () => ({ mayChangeDeployment: jest.fn(async () => true) }))
jest.mock('../SupabaseSyncService', () => ({
	__esModule: true,
	default: { requestSync: jest.fn(), debouncedSync: jest.fn() },
}))
jest.mock('../ProjectService', () => ({ __esModule: true, default: { getProjectById: jest.fn() } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/** The deployment as this phone last pulled it, before the website moved its site */
const seedOldCopy = (fields: Record<string, any> = {}) => seedRows('deployments', [{
	id: 'dep-1',
	projectId: 'project-1',
	deviceId: 'device-1',
	name: 'Ridge',
	setupBy: 'user-1',
	deploymentStart: new Date('2026-10-01T00:00:00Z'),
	deploymentEnd: null,
	deploymentStatusId: DEPLOYMENT_STATUS.STARTED,
	locationName: 'Old site',
	latitude: -41.29,
	longitude: 174.78,
	cameraLocationImagePaths: [],
	createdAt: Date.parse('2026-10-01T00:00:00Z'),
	updatedAt: Date.parse('2026-10-01T00:00:00Z'),
	...fields,
}])[0]

const queuedPayloads = () => rowsIn('sync_outbox').map((op) => ({ type: op.operationType, payload: JSON.parse(op.payload) }))

beforeEach(() => {
	resetFakeDatabase()
	mockFiles.clear()
})

describe('a deployment update sends only the columns it changed (#411)', () => {
	it('ending a deployment sends the end, and no location', async () => {
		seedOldCopy()

		await DeploymentService.endDeployment('dep-1', 'user-1', 'Retrieved')

		const [{ type, payload }] = queuedPayloads()
		expect(type).toBe('UPDATE')
		expect(Object.keys(payload).sort()).toEqual([
			'deployment_end', 'deployment_status_id', 'end_deployment_comments', 'ended_by', 'id', 'updated_at',
		])
		expect(payload).toEqual(expect.objectContaining({
			id: 'dep-1',
			deployment_status_id: DEPLOYMENT_STATUS.ENDED,
			ended_by: 'user-1',
			end_deployment_comments: 'Retrieved',
		}))
		// The phone's record is ended in full all the same
		expect(rowsIn('deployments')[0]).toEqual(expect.objectContaining({
			deploymentStatusId: DEPLOYMENT_STATUS.ENDED,
			locationName: 'Old site',
		}))
	})

	it('leaves out a comment the end did not change', async () => {
		seedOldCopy()

		await DeploymentService.endDeployment('dep-1', 'user-1')

		expect(queuedPayloads()[0].payload).not.toHaveProperty('end_deployment_comments')
	})

	it('swapping in an uploaded photo sends the path list, and no location', async () => {
		seedOldCopy({ cameraLocationImagePaths: [LOCAL] })
		mockFiles.add(LOCAL)

		await DeploymentPhotoService.uploadPendingPhotos('dep-1', 'user-1')

		const [{ type, payload }] = queuedPayloads()
		expect(type).toBe('UPDATE')
		expect(Object.keys(payload).sort()).toEqual(['camera_location_image_paths', 'id', 'updated_at'])
		expect(payload.camera_location_image_paths).toEqual(['project-1/dep-1/1-a.jpeg'])
	})
})
