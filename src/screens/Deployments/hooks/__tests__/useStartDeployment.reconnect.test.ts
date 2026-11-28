import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useStartDeployment } from '../useStartDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #571: the camera drops the link while the phone camera is open for the Site
 * Photo (the JS keep-alive pauses in the background). Start Monitoring says so
 * on the screen and reconnects in place, keeping what was entered, instead of
 * an alert whose OK went back and lost the form.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const project = (id: string, name: string) => ({ id, name, capture_method_id: 1, model_id: null, lorawan_required: false })
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
	testLorawan: jest.fn(), lorawanRequiredWarning: jest.fn(), LORAWAN_REQUIRED_WARNING: 'LoRaWAN',
	lorawanRegistrationWarning: jest.fn(), LORAWAN_REGISTRATION_WARNING: 'This camera',
	requestLorawanCheckIn: jest.fn(async () => 'sent'), describeLorawanCheckIn: jest.fn(() => 'LoRaWAN: first check-in sent'),
}))
jest.mock('../../../../ble/protocol/selfTestCache', () => ({ selfTestCache: { getFresh: jest.fn() } }))
jest.mock('../../../../ble/workflows/deploymentPipeline', () => ({
	resolveFirmwareIds: jest.fn(async () => ({})),
	syncAiModel: jest.fn(), syncTime: jest.fn(), resetOps: jest.fn(async () => null),
	configureDevice: jest.fn(), measureLight: jest.fn(),
}))
jest.mock('../../../../providers/BleEngineProvider', () => ({ useBleActions: jest.fn() }))
jest.mock('../../../../hooks/useDeploymentConfiguration', () => ({ useDeploymentConfiguration: () => ({ configure: mockConfigure }), deploymentPingMinutes: () => null }))
const mockConnectDevice = jest.fn()
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ disconnectDevice: jest.fn(), connectDevice: mockConnectDevice }) }))
jest.mock('../../../../hooks/useGPSLocation', () => ({ useGPSLocation: () => ({ getLocation: mockGetLocation, location: null }) }))
jest.mock('../../../../hooks/useDeviceSettings', () => ({
	useDeviceSettings: () => ({ quiesceDevice: jest.fn() }),
	OP_PARAMETER: { MODEL_PROJECT: 14, MODEL_VERSION: 15, AE_CHECK_INTERVAL: 24, AE_FLASH_STATE: 25, SLOT_SWITCH: 26, FLASH_MODE: 34 },
}))
jest.mock('../../../../hooks/useMonitoringActions', () => ({ useMonitoringActions: () => mockMonitoring }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))


const checkServer = DeploymentService.checkServerForOpenDeployment as jest.Mock

const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mount = async () => {
	const navigation = { addListener: jest.fn(() => jest.fn()), navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) }
	const hook = renderHook(() => useStartDeployment({
		deviceId: 'device-1', bleDeviceId: 'ble-1', projectId: 'project-1', navigation,
	}))
	await settle()
	return { ...hook, navigation }
}

const setConnected = (connected: boolean) => {
	mockState.devices['ble-1'] = { ...mockState.devices['ble-1'], connected }
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('projects', mockProjects.map(p => ({ id: p.id, name: p.name })))
	seedRows('user_roles', [{ userId: 'user-1', role: 'project_member', scopeType: 'project', scopeId: 'project-1', isActive: true }])
	checkServer.mockResolvedValue({ kind: 'none' })
	setConnected(true)
})

describe('Start Monitoring when the camera drops the link during setup (#571)', () => {
	it('shows nothing while the camera is connected', async () => {
		const { result } = await mount()

		expect(result.current.connectionLost).toBe(false)
	})

	it('says so on the screen, with no alert and without leaving it', async () => {
		const { result, rerender, navigation } = await mount()

		setConnected(false)
		rerender({})
		await settle()

		expect(result.current.connectionLost).toBe(true)
		expect(Alert.alert).not.toHaveBeenCalled()
		expect(navigation.goBack).not.toHaveBeenCalled()
	})

	it('keeps what was entered across the drop', async () => {
		const { result, rerender } = await mount()
		act(() => {
			result.current.handleNotesChange('Bait: peanut butter')
			result.current.handleCameraHeightChange('50')
		})

		setConnected(false)
		rerender({})
		await settle()

		expect(result.current.formState.notes).toBe('Bait: peanut butter')
		expect(result.current.formState.cameraHeight).toBe('50')
	})

	it('reconnects to the same camera, and says when it did not answer', async () => {
		const { result, rerender } = await mount()
		setConnected(false)
		rerender({})
		await settle()
		mockConnectDevice.mockResolvedValueOnce({ id: 'ble-1', connected: false })

		await act(async () => { await result.current.handleReconnect() })

		expect(mockConnectDevice).toHaveBeenCalledWith(expect.objectContaining({ id: 'ble-1', connected: false }), 20000)
		expect(result.current.reconnectFailed).toBe(true)
		expect(result.current.isReconnecting).toBe(false)

		mockConnectDevice.mockResolvedValueOnce({ id: 'ble-1', connected: true })
		await act(async () => { await result.current.handleReconnect() })
		setConnected(true)
		rerender({})
		await settle()

		expect(result.current.reconnectFailed).toBe(false)
		expect(result.current.connectionLost).toBe(false)
	})

	it('refuses Start while disconnected and points at Reconnect', async () => {
		const { result, rerender } = await mount()
		setConnected(false)
		rerender({})
		await settle()

		await act(async () => { await result.current.handleStartDeployment() })

		expect(Alert.alert).toHaveBeenCalledWith('Camera Not Connected', "Press the camera's middle button, then tap Reconnect at the top of the screen.", [{ text: 'OK' }])
		expect(checkServer).not.toHaveBeenCalled()
	})
})
