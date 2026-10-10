import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useStartDeployment } from '../useStartDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { getSupabaseClient } from '../../../../services/supabase'
import * as pipeline from '../../../../ble/workflows/deploymentPipeline'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #450: Start Monitoring asks the phone's roles whether this account may
 * deploy into the project, before the server check and before anything is
 * written to the camera. The server refuses a viewer's deployment
 * (ww-backend 52_deployments.sql), so a viewer is stopped and told why. The
 * picker offers only the projects the account may deploy into.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const project = (id: string, name: string) => ({ id, name, capture_method_id: null, model_id: null, lorawan_required: false })
const mockProjects = [project('project-1', 'Sinbad Gully'), project('project-2', 'Orokonui'), project('project-3', 'Zealandia')]
const mockExecute = jest.fn(async (command: string): Promise<any> => {
	if (command === 'getops') return Array(37).fill('0')
	if (command === 'slots') return { running: 'RP3' }
	return 'v1.0.0'
})
const mockSession = { execute: mockExecute }
const mockGetLocation = jest.fn()
const mockMonitoring = { isMonitoring: false, setIsMonitoring: jest.fn() }
const mockConfigure = jest.fn()

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
	DeploymentService: { checkServerForOpenDeployment: jest.fn(), createDeployment: jest.fn() },
}))
jest.mock('../../../../services/DeploymentPhotoService', () => ({
	DeploymentPhotoService: { uploadPendingPhotos: jest.fn(), removeLocalPhoto: jest.fn() },
}))
jest.mock('../../../../services/ProjectService', () => ({
	__esModule: true,
	default: {
		getProjectById: jest.fn(async (id: string) => mockProjects.find(p => p.id === id) ?? null),
		getProjectsForUserInOrganisation: jest.fn(async () => mockProjects),
	},
}))
jest.mock('../../../../services/ReferenceDataService', () => ({
	__esModule: true,
	default: { getCaptureMethods: jest.fn(async () => []), getActivitySensitivity: jest.fn(async () => []) },
}))
jest.mock('../../../../services/DeviceService', () => ({
	DeviceService: { getDeviceById: jest.fn(async () => ({ id: 'device-1' })) },
}))
jest.mock('../../../../services/FirmwareService', () => ({
	__esModule: true,
	default: { getFirmwareIdByVersion: jest.fn(async () => null) },
}))
jest.mock('../../../../hooks/useBleSession', () => ({ useBleSession: () => mockSession }))
jest.mock('../../../../ble/protocol/commandRegistry', () => ({
	commandRegistry: { getops: 'getops', version: 'version', network: 'network', slots: 'slots', disconnect: 'disconnect' },
}))
jest.mock('../../../../ble/workflows/checkSdCard', () => ({ checkSdCard: jest.fn() }))
jest.mock('../../../../ble/workflows/lorawanPing', () => ({
	pingLorawan: jest.fn(), lorawanRequiredWarning: jest.fn(), LORAWAN_REQUIRED_WARNING: 'LoRaWAN',
}))
jest.mock('../../../../ble/protocol/selfTestCache', () => ({ selfTestCache: { getFresh: jest.fn() } }))
jest.mock('../../../../ble/workflows/deploymentPipeline', () => ({
	syncAiModel: jest.fn(), syncTime: jest.fn(), resetOps: jest.fn(async () => null),
	configureDevice: jest.fn(), measureLight: jest.fn(),
}))
jest.mock('../../../../providers/BleEngineProvider', () => ({ useBleActions: jest.fn() }))
jest.mock('../../../../hooks/useDeploymentConfiguration', () => ({ useDeploymentConfiguration: () => ({ configure: mockConfigure }) }))
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ disconnectDevice: jest.fn() }) }))
jest.mock('../../../../hooks/useGPSLocation', () => ({ useGPSLocation: () => ({ getLocation: mockGetLocation, location: null }) }))
jest.mock('../../../../hooks/useDeviceSettings', () => ({
	useDeviceSettings: () => ({ quiesceDevice: jest.fn() }),
	OP_PARAMETER: { MODEL_PROJECT: 14, MODEL_VERSION: 15, AE_CHECK_INTERVAL: 24, AE_FLASH_STATE: 25, SLOT_SWITCH: 26, FLASH_MODE: 34 },
}))
jest.mock('../../../../hooks/useMonitoringActions', () => ({ useMonitoringActions: () => mockMonitoring }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const checkServer = DeploymentService.checkServerForOpenDeployment as jest.Mock
const createDeployment = DeploymentService.createDeployment as jest.Mock

const VIEWER_MESSAGE = 'You are a viewer in "Sinbad Gully", and viewers cannot start monitoring. Ask a project admin to make you a member.'

const role = (name: string, scopeType: string, scopeId: string | null) => ({ userId: 'user-1', role: name, scopeType, scopeId, isActive: true })

/** Let the screen's loads settle */
const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mount = async () => {
	const navigation = { addListener: jest.fn(() => jest.fn()), navigate: jest.fn(), canGoBack: jest.fn(() => false) }
	const hook = renderHook(() => useStartDeployment({
		deviceId: 'device-1', bleDeviceId: 'ble-1', projectId: 'project-1', navigation,
	}))
	await settle()
	expect(hook.result.current.project?.id).toBe('project-1')
	mockExecute.mockClear()
	return hook
}

const start = async (result: { current: ReturnType<typeof useStartDeployment> }) => {
	await act(async () => { await result.current.handleStartDeployment() })
}

const expectNothingStarted = (result: { current: ReturnType<typeof useStartDeployment> }) => {
	expect(checkServer).not.toHaveBeenCalled()
	expect(mockExecute).not.toHaveBeenCalled()
	expect(pipeline.syncAiModel).not.toHaveBeenCalled()
	expect(createDeployment).not.toHaveBeenCalled()
	expect(result.current.isFinishing).toBe(false)
	expect(result.current.submitting).toBe(false)
}

const expectStarted = () => {
	expect(Alert.alert).not.toHaveBeenCalled()
	expect(checkServer).toHaveBeenCalledWith('device-1', 'user-1')
	expect(mockExecute).toHaveBeenCalledWith('getops')
	expect(createDeployment).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', setupBy: 'user-1' }))
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('projects', mockProjects.map(p => ({ id: p.id, name: p.name })))
	checkServer.mockResolvedValue({ kind: 'none' })
	createDeployment.mockResolvedValue({ id: 'dep-new-0001', deploymentStart: new Date() })
})

describe('Start Monitoring and the project role (#450)', () => {
	it('stops a viewer before the server check or any camera command, and says why', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1')])
		const { result } = await mount()

		expect(result.current.startRefusalReason).toBe(VIEWER_MESSAGE)
		await start(result)

		expect(Alert.alert).toHaveBeenCalledWith('Cannot Start Monitoring', VIEWER_MESSAGE)
		expectNothingStarted(result)
	})

	it('lets a member start', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		const { result } = await mount()

		expect(result.current.startRefusalReason).toBeNull()
		await start(result)

		expectStarted()
	})

	it('lets a ww_admin start in any project', async () => {
		seedRows('user_roles', [role('ww_admin', 'system', null)])
		const { result } = await mount()

		await start(result)

		expectStarted()
	})

	it('stops an organisation manager with no role in the project, as the server does', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-1')])
		const { result } = await mount()

		await start(result)

		expect(Alert.alert).toHaveBeenCalledWith('Cannot Start Monitoring', expect.stringMatching(/^You are not a member of "Sinbad Gully"/))
		expectNothingStarted(result)
	})

	it('stops a start when no roles have reached the phone', async () => {
		const { result } = await mount()

		await start(result)

		expect(Alert.alert).toHaveBeenCalledWith('Cannot Start Monitoring', expect.stringMatching(/^Your roles have not reached this phone yet/))
		expectNothingStarted(result)
	})

	it('answers offline from the roles on the phone, without asking the server who may', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		checkServer.mockResolvedValue({ kind: 'unchecked', message: 'Could not ask the server.' })
		const { result } = await mount()

		await start(result)

		expect(getSupabaseClient).not.toHaveBeenCalled()
		expect(createDeployment).toHaveBeenCalled()
	})

	it('asks again at the press: a role taken away since the screen opened stops it', async () => {
		const [member] = seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		const { result } = await mount()
		expect(result.current.startRefusalReason).toBeNull()

		member.role = 'project_viewer'
		await start(result)

		expect(Alert.alert).toHaveBeenCalledWith('Cannot Start Monitoring', VIEWER_MESSAGE)
		expect(result.current.startRefusalReason).toBe(VIEWER_MESSAGE)
		expectNothingStarted(result)
	})

	it('offers only the projects it may deploy into, keeping the scanner\'s choice while it is selected', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1'), role('project_member', 'project', 'project-2')])
		const { result } = await mount()

		expect(result.current.availableProjects.map(p => p.id)).toEqual(['project-1', 'project-2'])

		await act(async () => { await result.current.handleProjectChange('project-2') })
		await settle()

		expect(result.current.project?.id).toBe('project-2')
		expect(result.current.availableProjects.map(p => p.id)).toEqual(['project-2'])
		expect(result.current.startRefusalReason).toBeNull()
	})
})
