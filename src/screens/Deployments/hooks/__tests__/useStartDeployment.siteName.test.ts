import { renderHook, act } from '@testing-library/react-native'

import { useStartDeployment } from '../useStartDeployment'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #572: Site Name fills in by itself only from one of the project's earlier
 * sites within 200 m of the phone. Farther ones are still offered in the
 * list, and with none that close the field starts empty. On the bench a phone
 * in New Plymouth was given a Tongariro site about 150 km away.
 */

const mockState = {
	devices: { 'ble-1': { id: 'ble-1', name: 'WILD-TEST', connected: true } },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
}
const mockProject = { id: 'project-1', name: 'Sinbad Skink Survey', capture_method_id: 1, model_id: null, lorawan_required: false }
const mockSession = { execute: jest.fn() }
const mockGetLocation = jest.fn()
const mockMonitoring = { isMonitoring: false, setIsMonitoring: jest.fn() }
let mockLocation: { latitude: number; longitude: number; altitude: number; accuracy: number; timestamp: number } | null = null

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
	testLorawan: jest.fn(), lorawanRequiredWarning: jest.fn(), LORAWAN_REQUIRED_WARNING: 'LoRaWAN',
	lorawanRegistrationWarning: jest.fn(), LORAWAN_REGISTRATION_WARNING: 'This camera',
	requestLorawanCheckIn: jest.fn(), describeLorawanCheckIn: jest.fn(),
}))
jest.mock('../../../../ble/protocol/selfTestCache', () => ({ selfTestCache: { getFresh: jest.fn() } }))
jest.mock('../../../../ble/workflows/deploymentPipeline', () => ({
	resolveFirmwareIds: jest.fn(), syncAiModel: jest.fn(), syncTime: jest.fn(), resetOps: jest.fn(),
	configureDevice: jest.fn(), measureLight: jest.fn(),
}))
jest.mock('../../../../providers/BleEngineProvider', () => ({ useBleActions: jest.fn() }))
jest.mock('../../../../hooks/useDeploymentConfiguration', () => ({ useDeploymentConfiguration: () => ({ configure: jest.fn() }), deploymentPingMinutes: () => null }))
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ disconnectDevice: jest.fn() }) }))
jest.mock('../../../../hooks/useGPSLocation', () => ({ useGPSLocation: () => ({ getLocation: mockGetLocation, location: mockLocation }) }))
jest.mock('../../../../hooks/useDeviceSettings', () => ({
	useDeviceSettings: () => ({ quiesceDevice: jest.fn() }),
	OP_PARAMETER: { MODEL_PROJECT: 14, MODEL_VERSION: 15, AE_CHECK_INTERVAL: 24, AE_FLASH_STATE: 25, SLOT_SWITCH: 26, FLASH_MODE: 34 },
}))
jest.mock('../../../../hooks/useMonitoringActions', () => ({ useMonitoringActions: () => mockMonitoring }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

// The phone, in New Plymouth. 0.001 degrees of latitude is about 111 m.
const PHONE = { latitude: -39.057, longitude: 174.075 }
const site = (locationName: string, latitude: number, longitude: number, projectId = 'project-1') => ({ projectId, locationName, latitude, longitude })
const NEAR = site('Te Henui Walkway', PHONE.latitude + 0.001, PHONE.longitude) // about 111 m
const JUST_PAST = site('Pukekura Park', PHONE.latitude + 0.0025, PHONE.longitude) // about 280 m
const TONGARIRO = site('Tongariro National Park - Whakapapanui Stream', -39.2, 175.55) // about 128 km

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
	return hook
}

const offered = (result: { current: ReturnType<typeof useStartDeployment> }) => result.current.availableLocations.map(o => o.value)

beforeEach(() => {
	resetFakeDatabase()
	mockLocation = { ...PHONE, altitude: 10, accuracy: 5, timestamp: Date.now() }
})

describe('Site Name from the project\'s earlier sites (#572)', () => {
	it('fills in a site within 200 m of the phone, and offers the farther ones after it', async () => {
		seedRows('deployments', [TONGARIRO, NEAR])
		const { result } = await mount()

		expect(result.current.locationName).toBe('Te Henui Walkway')
		expect(result.current.isCustomLocation).toBe(false)
		expect(offered(result)).toEqual(['Te Henui Walkway', 'Tongariro National Park - Whakapapanui Stream'])
	})

	it('fills in nothing from sites farther than 200 m, and still offers them, nearest first', async () => {
		seedRows('deployments', [TONGARIRO, JUST_PAST])
		const { result } = await mount()

		expect(result.current.locationName).toBe('')
		expect(result.current.isCustomLocation).toBe(true)
		expect(offered(result)).toEqual(['Pukekura Park', 'Tongariro National Park - Whakapapanui Stream'])
	})

	it('leaves Site Name empty when the project has no earlier sites', async () => {
		// Another project's site next to the phone is not this project's
		seedRows('deployments', [site('Elsewhere', PHONE.latitude, PHONE.longitude, 'project-2')])
		const { result } = await mount()

		expect(result.current.locationName).toBe('')
		expect(result.current.isCustomLocation).toBe(true)
		expect(offered(result)).toEqual([])
	})
})
