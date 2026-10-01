import { DeploymentPhotoService } from '../DeploymentPhotoService'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

jest.mock('../SupabaseSyncService', () => ({
	__esModule: true,
	default: { debouncedSync: jest.fn() },
}))

jest.mock('../supabase', () => ({ getSupabaseClient: () => ({}) }))

describe('DeploymentPhotoService.uploadAllPending', () => {
	// #330: the project reconcile keeps a deployment with unsynced work after its
	// project is gone; uploading its photos could only be refused, every sync
	it('leaves the photos of a deployment whose project is gone on the phone', async () => {
		resetFakeDatabase()
		seedRows('projects', [{ id: 'live-project' }])
		seedRows('deployments', [
			{ id: 'on-live', projectId: 'live-project', cameraLocationImagePaths: ['file:///photos/a.jpg'] },
			{ id: 'on-gone', projectId: 'gone-project', cameraLocationImagePaths: ['file:///photos/b.jpg'] },
		])
		const upload = jest.spyOn(DeploymentPhotoService, 'uploadPendingPhotos').mockResolvedValue()

		await DeploymentPhotoService.uploadAllPending('user-1')

		expect(upload).toHaveBeenCalledTimes(1)
		expect(upload).toHaveBeenCalledWith('on-live', 'user-1')
	})
})
