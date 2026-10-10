import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useDevDeployment } from '../useDevDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #448 in the Dev Deployment Test: an open deployment on this phone still
 * blocks Start as before, without asking the server; then the server is asked
 * about one the phone does not hold, before the camera switch or anything else
 * touches the device.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const mockProject = { id: 'project-1', name: 'Sinbad Gully', capture_method_id: 1, model_id: null, lorawan_required: false, record_gps_in_images: false }
const mockExecute = jest.fn(async (command: any): Promise<any> => (command === 'getops' ? Array(37).fill('0') : 80))
const mockSession = { execute: mockExecute }
const mockGetLocation = jest.fn()
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
	DeviceService: { getDeviceByBluetoothId: jest.fn(async () => ({ id: 'device-1' })) },
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
jest.mock('../../../../hooks/useGPSLocation', () => ({ useGPSLocation: () => ({ getLocation: mockGetLocation, location: null }) }))
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

const localActive = DeploymentService.getActiveDeploymentForDeviceId as jest.Mock
const checkServer = DeploymentService.checkServerForOpenDeployment as jest.Mock
const createDeployment = DeploymentService.createDeployment as jest.Mock

/** Let the screen's loads and the checks on connect settle */
const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mount = async () => {
	const hook = renderHook(() => useDevDeployment({ deviceId: 'ble-1', bleDeviceId: 'ble-1', navigation: {} }))
	await settle()
	expect(hook.result.current.project?.id).toBe('project-1')
	expect(hook.result.current.cameraChoice).toBe('RP3')
	// The battery and SD card reads on connect are not part of the start
	mockExecute.mockClear()
	mockCamera.switchTo.mockClear()
	return hook
}

const start = async (result: { current: ReturnType<typeof useDevDeployment> }) => {
	await act(async () => { await result.current.handleStartDeployment() })
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	// A member may start one (#450, useDevDeployment.roles.test.ts)
	resetFakeDatabase()
	seedRows('user_roles', [{ userId: 'user-1', role: 'project_member', scopeType: 'project', scopeId: 'project-1', isActive: true }])
	localActive.mockResolvedValue(undefined)
	createDeployment.mockResolvedValue({ id: 'dep-new-0001', deploymentStart: new Date() })
})

describe('Dev Deployment and an open deployment on the server (#448)', () => {
	it('stops before the camera switch or any command when the server has one', async () => {
		const message = 'This camera is still deployed in "Other", started by Tui Smith on 3/10/2026.'
		checkServer.mockResolvedValue({ kind: 'open', message })
		const { result } = await mount()

		await start(result)

		expect(checkServer).toHaveBeenCalledWith('device-1', 'user-1')
		expect(Alert.alert).toHaveBeenCalledWith('Already Deployed', message)
		expect(mockCamera.switchTo).not.toHaveBeenCalled()
		expect(mockExecute).not.toHaveBeenCalled()
		expect(createDeployment).not.toHaveBeenCalled()
		expect(result.current.submitting).toBe(false)
	})

	it('carries on with a warning when the server could not be asked', async () => {
		const message = 'Could not ask the server whether this camera is still deployed elsewhere. If it is, the server will refuse this deployment.'
		checkServer.mockResolvedValue({ kind: 'unchecked', message })
		const { result } = await mount()

		await start(result)

		expect(result.current.finishLogs).toContain(`⚠️ ${message}`)
		expect(checkServer.mock.invocationCallOrder[0]).toBeLessThan(mockCamera.switchTo.mock.invocationCallOrder[0])
		expect(mockExecute).toHaveBeenCalledWith('getops')
		expect(createDeployment).toHaveBeenCalled()
	})

	it('still blocks on the open deployment this phone holds, without asking the server', async () => {
		localActive.mockResolvedValue({ id: 'dep-local', locationName: 'Ridge' })
		const { result } = await mount()

		await start(result)

		expect(Alert.alert).toHaveBeenCalledWith('Already Deployed', expect.stringContaining('already deployed at Ridge'))
		expect(checkServer).not.toHaveBeenCalled()
		expect(mockCamera.switchTo).not.toHaveBeenCalled()
		expect(createDeployment).not.toHaveBeenCalled()
	})
})
