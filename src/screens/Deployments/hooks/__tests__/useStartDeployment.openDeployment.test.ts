import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useStartDeployment } from '../useStartDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import * as pipeline from '../../../../ble/workflows/deploymentPipeline'

/**
 * #448: Start Monitoring asks the server about an open deployment on the
 * camera that this phone does not hold, before anything is written to the
 * camera. One found stops the start; none found, offline or a failed read
 * carries on, the last two with a warning in the progress log.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const mockProject = { id: 'project-1', name: 'Sinbad Gully', capture_method_id: null, model_id: null, lorawan_required: false }
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
	default: { getProjectById: jest.fn(async () => mockProject), getProjectsForUserInOrganisation: jest.fn(async () => []) },
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

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	createDeployment.mockResolvedValue({ id: 'dep-new-0001', deploymentStart: new Date() })
})

describe('Start Monitoring and an open deployment on the server (#448)', () => {
	it('stops before any camera command when the server has one', async () => {
		const message = 'This camera is still deployed in "Other", started by Tui Smith on 3/10/2026.'
		checkServer.mockResolvedValue({ kind: 'open', message })
		const { result } = await mount()

		await start(result)

		expect(checkServer).toHaveBeenCalledWith('device-1', 'user-1')
		expect(Alert.alert).toHaveBeenCalledWith('Already Deployed', message)
		expect(mockExecute).not.toHaveBeenCalled()
		expect(pipeline.syncAiModel).not.toHaveBeenCalled()
		expect(createDeployment).not.toHaveBeenCalled()
		expect(result.current.isFinishing).toBe(false)
		expect(result.current.submitting).toBe(false)
	})

	it('carries on when the server has none', async () => {
		checkServer.mockResolvedValue({ kind: 'none' })
		const { result } = await mount()

		await start(result)

		expect(mockExecute).toHaveBeenCalledWith('getops')
		expect(checkServer.mock.invocationCallOrder[0]).toBeLessThan(mockExecute.mock.invocationCallOrder[0])
		expect(createDeployment).toHaveBeenCalled()
		expect(result.current.finishLogs.some(line => line.startsWith('⚠️'))).toBe(false)
		expect(Alert.alert).not.toHaveBeenCalled()
	})

	it('carries on with a warning when the server could not be asked', async () => {
		const message = 'Could not ask the server whether this camera is still deployed elsewhere. If it is, the server will refuse this deployment.'
		checkServer.mockResolvedValue({ kind: 'unchecked', message })
		const { result } = await mount()

		await start(result)

		expect(result.current.finishLogs).toContain(`⚠️ ${message}`)
		expect(mockExecute).toHaveBeenCalledWith('getops')
		expect(createDeployment).toHaveBeenCalled()
		expect(Alert.alert).not.toHaveBeenCalled()
	})
})
