import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useDevDeployment } from '../useDevDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { DeviceService } from '../../../../services/DeviceService'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #480: the Engineer Console connects without the scanner, which is what
 * registers a camera, so the Dev Deployment Test can be opened on a camera the
 * phone has no row for. Its deployment was saved with no camera, never
 * uploaded and never found again. Start now registers the camera first, the way
 * the scanner does, and deploys it under that row, or starts nothing.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const mockProject = { id: 'project-1', name: 'Sinbad Gully', capture_method_id: 1, model_id: null, lorawan_required: false, record_gps_in_images: false }
const mockExecute = jest.fn(async (command: any): Promise<any> => (command === 'getops' ? Array(37).fill('0') : 80))
const mockSession = { execute: mockExecute }
const mockMonitoring = { isMonitoring: false, setIsMonitoring: jest.fn() }
const mockCamera = { switchTo: jest.fn(async () => true), refresh: jest.fn(), activeCamera: 'RP3', isBusy: false, stage: null }
const mockSelfTest = { bits: 0, issues: [], isChecking: false, refresh: jest.fn() }

jest.mock('../../../../redux', () => ({ useAppSelector: (select: (state: any) => any) => select(mockState) }))
jest.mock('../../../../redux/slices/authSlice', () => ({
	selectCurrentOrganisation: (state: any) => state.authentication.currentOrganisation,
}))
jest.mock('../../../../database', () => ({
	__esModule: true,
	default: require('../../../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('@react-navigation/native', () => ({
	useFocusEffect: (effect: () => void) => require('react').useEffect(() => { effect() }, [effect]),
}))
jest.mock('../../../../services/DeploymentService', () => ({
	DeploymentService: {
		getActiveDeploymentForDeviceId: jest.fn(), checkServerForOpenDeployment: jest.fn(), createDeployment: jest.fn(),
	},
}))
jest.mock('../../../../services/ProjectService', () => ({
	__esModule: true,
	default: { getProjectsForUserInOrganisation: jest.fn(async () => [mockProject]), updateProject: jest.fn() },
}))
jest.mock('../../../../services/ReferenceDataService', () => ({
	__esModule: true,
	default: { getCaptureMethods: jest.fn(async () => []), getActivitySensitivity: jest.fn(async () => []), getAiModels: jest.fn(async () => []) },
}))
jest.mock('../../../../services/DeviceService', () => ({
	DeviceService: { getDeviceByBluetoothId: jest.fn(), adoptFromServer: jest.fn(), createDevice: jest.fn() },
}))
jest.mock('../../../../hooks/useBleSession', () => ({ useBleSession: () => mockSession }))
jest.mock('../../../../ble/protocol/commandRegistry', () => ({
	commandRegistry: { getops: 'getops', battery: 'battery', selftest: 'selftest', setop: jest.fn(), aiflash: jest.fn() },
}))
jest.mock('../../../../ble/workflows/checkSdCard', () => ({ checkSdCard: jest.fn(async () => ({ totalSpaceKb: 100, freeSpaceKb: 50 })) }))
jest.mock('../../../../ble/protocol/selfTestCache', () => ({ selfTestCache: { waitForFresh: jest.fn(async () => ({ bits: 0 })) } }))
jest.mock('../../../../ble/workflows/deploymentPipeline', () => ({
	syncAiModel: jest.fn(), syncTime: jest.fn(), resetOps: jest.fn(async () => null), configureDevice: jest.fn(),
}))
jest.mock('../../../../providers/BleEngineProvider', () => ({ useBleActions: jest.fn() }))
jest.mock('../../../../hooks/useDeploymentConfiguration', () => ({ useDeploymentConfiguration: () => ({ configure: jest.fn() }) }))
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ disconnectDevice: jest.fn() }) }))
jest.mock('../../../../hooks/useGPSLocation', () => ({ useGPSLocation: () => ({ getLocation: jest.fn(), location: null }) }))
jest.mock('../../../../hooks/useDeviceSettings', () => ({
	useDeviceSettings: () => ({ quiesceDevice: jest.fn() }),
	OP_PARAMETER: { NUM_PICTURES: 5, LED_BRIGHTNESS: 9, MD_FLASH_BRIGHTNESS_PERCENT: 22 },
	FACTORY_DEFAULTS: { 22: 50 },
}))
jest.mock('../../../../hooks/useMonitoringActions', () => ({ useMonitoringActions: () => mockMonitoring, endDeploymentSequence: jest.fn() }))
jest.mock('../../../../hooks/useCameraSwitch', () => ({
	useCameraSwitch: () => mockCamera,
	CAMERA_VARIANT_LABELS: { RP3: 'Colour', HM0360: 'Black & White', unknown: 'Unknown' },
}))
jest.mock('../../../../hooks/useDeviceSelfTest', () => ({ useDeviceSelfTest: () => mockSelfTest }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const deviceService = DeviceService as jest.Mocked<typeof DeviceService>
const localActive = DeploymentService.getActiveDeploymentForDeviceId as jest.Mock
const checkServer = DeploymentService.checkServerForOpenDeployment as jest.Mock
const createDeployment = DeploymentService.createDeployment as jest.Mock

const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mountAndStart = async () => {
	const hook = renderHook(() => useDevDeployment({ deviceId: 'ble-1', bleDeviceId: 'ble-1', navigation: {} }))
	await settle()
	expect(hook.result.current.project?.id).toBe('project-1')
	mockExecute.mockClear()
	mockCamera.switchTo.mockClear()
	await act(async () => { await hook.result.current.handleStartDeployment() })
	return hook
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('user_roles', [{ userId: 'user-1', role: 'project_member', scopeType: 'project', scopeId: 'project-1', isActive: true }])
	deviceService.getDeviceByBluetoothId.mockResolvedValue(undefined)
	deviceService.adoptFromServer.mockResolvedValue({ kind: 'none' })
	deviceService.createDevice.mockResolvedValue({ id: 'device-new' } as any)
	localActive.mockResolvedValue(undefined)
	checkServer.mockResolvedValue({ kind: 'none' })
	createDeployment.mockResolvedValue({ id: 'dep-new-0001', deploymentStart: new Date() })
})

describe('Dev Deployment of a camera the phone has no row for (#480)', () => {
	it('registers it, in no organisation (#501), and deploys it under that row', async () => {
		await mountAndStart()

		expect(deviceService.createDevice).toHaveBeenCalledWith('ble-1', 'WILD-TEST', 'user-1')
		expect(localActive).toHaveBeenCalledWith('device-new')
		expect(checkServer).toHaveBeenCalledWith('device-new', 'user-1')
		expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-new' }))
	})

	it("takes the server's row when this account may read it", async () => {
		deviceService.adoptFromServer.mockResolvedValue({ kind: 'found', device: { id: 'device-server' } as any })

		await mountAndStart()

		expect(deviceService.createDevice).not.toHaveBeenCalled()
		expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-server' }))
	})

	it('starts nothing, and touches nothing on the camera, when no row can be saved', async () => {
		deviceService.createDevice.mockRejectedValue(new Error('disk full'))

		const { result } = await mountAndStart()

		expect(Alert.alert).toHaveBeenCalledWith('Cannot register this camera', expect.stringContaining('could not save a record of this camera'))
		expect(checkServer).not.toHaveBeenCalled()
		expect(mockCamera.switchTo).not.toHaveBeenCalled()
		expect(mockExecute).not.toHaveBeenCalled()
		expect(createDeployment).not.toHaveBeenCalled()
		expect(result.current.submitting).toBe(false)
	})

	it('asks the server nothing about a camera the phone already has', async () => {
		deviceService.getDeviceByBluetoothId.mockResolvedValue({ id: 'device-here' } as any)

		await mountAndStart()

		expect(deviceService.adoptFromServer).not.toHaveBeenCalled()
		expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'device-here' }))
	})
})
