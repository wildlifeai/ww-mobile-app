import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useDevDeployment } from '../useDevDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { endDeploymentSequence } from '../../../../hooks/useMonitoringActions'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #450 in the Dev Deployment Test: Start and the "Already deployed" card's End
 * deployment ask the phone's roles first, as Start Monitoring and Stop
 * Monitoring do, before anything touches the device.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const project = (id: string, name: string) => ({ id, name, capture_method_id: 1, model_id: null, lorawan_required: false, record_gps_in_images: false })
const mockProjects = [project('project-1', 'Sinbad Gully'), project('project-2', 'Orokonui')]
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
	default: { getProjectsForUserInOrganisation: jest.fn(async () => mockProjects), updateProject: jest.fn() },
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
const endSequence = endDeploymentSequence as jest.Mock

const role = (name: string, scopeType: string, scopeId: string | null) => ({ userId: 'user-1', role: name, scopeType, scopeId, isActive: true })
const running = (setupBy: string) => ({ id: 'dep-running', projectId: 'project-1', setupBy, locationName: 'Ridge' })

/** Let the screen's loads and the checks on connect settle */
const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mount = async () => {
	const hook = renderHook(() => useDevDeployment({ deviceId: 'ble-1', bleDeviceId: 'ble-1', navigation: {} }))
	await settle()
	mockExecute.mockClear()
	mockCamera.switchTo.mockClear()
	return hook
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('projects', mockProjects.map(p => ({ id: p.id, name: p.name })))
	seedRows('users', [{ id: 'user-tui', firstname: 'Tui Smith', surname: '' }])
	localActive.mockResolvedValue(undefined)
	checkServer.mockResolvedValue({ kind: 'none' })
	createDeployment.mockResolvedValue({ id: 'dep-new-0001', deploymentStart: new Date() })
	endSequence.mockResolvedValue({ cameraAnswered: true })
})

describe('Dev Deployment Start and the project role (#450)', () => {
	it('opens on the first project it may deploy into, and offers only those', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1'), role('project_member', 'project', 'project-2')])
		const { result } = await mount()

		expect(result.current.project?.id).toBe('project-2')
		expect(result.current.availableProjects.map(p => p.id)).toEqual(['project-2'])
		expect(result.current.startRefusalReason).toBeNull()
	})

	it('with none, opens on the first project it can see, says why, and a press stops before the device', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1'), role('project_viewer', 'project', 'project-2')])
		const { result } = await mount()
		const message = 'You are a viewer in "Sinbad Gully", and viewers cannot start monitoring. Ask a project admin to make you a member.'

		expect(result.current.project?.id).toBe('project-1')
		expect(result.current.startRefusalReason).toBe(message)
		await act(async () => { await result.current.handleStartDeployment() })

		expect(Alert.alert).toHaveBeenCalledWith('Cannot Start Monitoring', message)
		expect(checkServer).not.toHaveBeenCalled()
		expect(mockCamera.switchTo).not.toHaveBeenCalled()
		expect(mockExecute).not.toHaveBeenCalled()
		expect(createDeployment).not.toHaveBeenCalled()
	})

	it('lets a member start', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		const { result } = await mount()

		await act(async () => { await result.current.handleStartDeployment() })

		expect(Alert.alert).not.toHaveBeenCalled()
		expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1' }))
	})
})

describe('Dev Deployment End deployment and the project role (#450)', () => {
	const end = async (setupBy: string) => {
		localActive.mockResolvedValue(running(setupBy))
		const { result } = await mount()
		await act(async () => { await result.current.handleEndActiveDeployment() })
		return result
	}

	it('stops a viewer before the device is touched, naming who can end it', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1')])

		await end('user-tui')

		expect(Alert.alert).toHaveBeenCalledWith(
			'Cannot End This Deployment',
			'You are a viewer in "Sinbad Gully", and viewers cannot end deployments. Only Tui Smith, who started it, or a project admin can end it.',
		)
		expect(endSequence).not.toHaveBeenCalled()
	})

	it("stops a member ending someone else's, as the server does", async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])

		await end('user-tui')

		expect(Alert.alert).toHaveBeenCalledWith('Cannot End This Deployment', expect.stringMatching(/^Members can end only the deployments they started/))
		expect(endSequence).not.toHaveBeenCalled()
	})

	it('lets the creator end their own while a member', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])

		await end('user-1')

		expect(Alert.alert).not.toHaveBeenCalled()
		expect(endSequence).toHaveBeenCalledWith(expect.objectContaining({ deploymentId: 'dep-running', userId: 'user-1' }))
	})

	it("lets a project admin end anyone's", async () => {
		seedRows('user_roles', [role('project_admin', 'project', 'project-1')])

		await end('user-tui')

		expect(endSequence).toHaveBeenCalled()
	})
})
