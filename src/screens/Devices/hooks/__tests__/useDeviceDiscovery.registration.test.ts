import { Alert } from 'react-native'
import { renderHook, act } from '@testing-library/react-native'

import { useDeviceDiscovery } from '../useDeviceDiscovery'
import { DeviceService } from '../../../../services/DeviceService'

/**
 * A camera this phone has not met is asked of the server before the scanner
 * registers it (#451), and before the organisation check, so an account with
 * no organisation can still use a camera it may read. Only one that is neither
 * here nor readable there needs an organisation to register it.
 */

const mockState: any = {
	devices: {},
	scanning: { isEngineerConsoleActive: false },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
	sync: { hasCompletedInitialSync: true, isGlobalSyncing: false },
	network: { isOnline: true },
}
const mockNavigation = { navigate: jest.fn(), isFocused: jest.fn(() => true) }
const mockBleActions = {
	isBleConnecting: false,
	stopScan: jest.fn(async () => {}),
	connectDevice: jest.fn(async (device: any) => ({ ...device, connected: true })),
	disconnectDevice: jest.fn(async () => {}),
}
const mockAutoConnect = { resetAll: jest.fn(), transition: jest.fn(), canAutoConnect: jest.fn(() => true), resetDevice: jest.fn() }
const mockRunChecks = jest.fn(async () => ({}))

jest.mock('@react-navigation/native', () => ({
	useNavigation: () => mockNavigation,
	useRoute: () => ({ params: {} }),
	useIsFocused: () => true,
}))
jest.mock('../../../../redux', () => ({ useAppSelector: (select: (state: any) => any) => select(mockState) }))
jest.mock('../../../../redux/slices/authSlice', () => ({
	selectCurrentOrganisation: (state: any) => state.authentication.currentOrganisation,
}))
jest.mock('../../../../providers/BleEngineProvider', () => ({ useBleActions: () => mockBleActions }))
jest.mock('../../../../hooks/useDevicePreDeploymentChecks', () => ({ useDevicePreDeploymentChecks: () => ({ runChecks: mockRunChecks }) }))
jest.mock('../../../../hooks/useBleInitialization', () => ({ useBleInitialization: () => ({ initialize: jest.fn() }) }))
jest.mock('../../../../services/DeviceService', () => ({
	DeviceService: {
		getDeviceByBluetoothId: jest.fn(),
		adoptFromServer: jest.fn(),
		createDevice: jest.fn(),
		calculateDeviceStatus: jest.fn(),
	},
}))
jest.mock('../../../../services/DeploymentService', () => ({
	DeploymentService: {
		getActiveDeploymentForDeviceId: jest.fn(),
		getLastEndedDeploymentForDeviceId: jest.fn(),
	},
}))
jest.mock('../../../../services/ProjectService', () => ({
	__esModule: true,
	default: { getProjectsForUserInOrganisation: jest.fn() },
}))
jest.mock('../useAutoConnectStateMachine', () => ({ useAutoConnectStateMachine: () => mockAutoConnect }))
jest.mock('../../../../hooks/useScanLoop', () => ({ useScanLoop: () => ({ isScanning: false, flushBleCache: jest.fn() }) }))
jest.mock('../../../../services/SyncBarrier', () => ({ waitForInitialSync: jest.fn() }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const deviceService = DeviceService as jest.Mocked<typeof DeviceService>
const ProjectService = require('../../../../services/ProjectService').default

const selectCamera = async () => {
	const { result } = renderHook(() => useDeviceDiscovery())
	await act(async () => {
		await result.current.handleDeviceSelect({ id: 'ble-1', name: 'WILD-TEST' } as any)
	})
}

let alert: jest.SpyInstance

beforeEach(() => {
	mockState.authentication = { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } }
	alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	deviceService.getDeviceByBluetoothId.mockResolvedValue(undefined)
	deviceService.adoptFromServer.mockResolvedValue({ kind: 'none' })
	deviceService.createDevice.mockResolvedValue({ id: 'device-new' } as any)
	deviceService.calculateDeviceStatus.mockResolvedValue('needs_preparation')
	ProjectService.getProjectsForUserInOrganisation.mockResolvedValue([{ id: 'project-1' }])
})

describe('the scanner and a camera this phone has not met (#451)', () => {
	it("uses the server's device when this account may read it, and registers nothing", async () => {
		deviceService.adoptFromServer.mockResolvedValue({ kind: 'found', device: { id: 'device-server' } as any })

		await selectCamera()

		expect(deviceService.adoptFromServer).toHaveBeenCalledWith('ble-1')
		expect(deviceService.createDevice).not.toHaveBeenCalled()
		expect(mockNavigation.navigate).toHaveBeenCalledWith('StartMonitoringDetailsStep', expect.objectContaining({
			deviceId: 'device-server',
		}))
	})

	it('uses a readable camera with no organisation too', async () => {
		mockState.authentication.currentOrganisation = null
		deviceService.adoptFromServer.mockResolvedValue({ kind: 'found', device: { id: 'device-server' } as any })

		await selectCamera()

		expect(alert).not.toHaveBeenCalled()
		expect(deviceService.calculateDeviceStatus).toHaveBeenCalledWith('device-server')
	})

	it('registers it in the current organisation when the server has none this account may read', async () => {
		await selectCamera()

		expect(deviceService.createDevice).toHaveBeenCalledWith('ble-1', 'WILD-TEST', 'org-1', 'user-1')
		expect(mockNavigation.navigate).toHaveBeenCalledWith('StartMonitoringDetailsStep', expect.objectContaining({
			deviceId: 'device-new',
		}))
	})

	it('says who can register it when the account has no organisation', async () => {
		mockState.authentication.currentOrganisation = null

		await selectCamera()

		expect(deviceService.createDevice).not.toHaveBeenCalled()
		expect(alert).toHaveBeenCalledWith('Cannot register this camera', expect.stringContaining(
			'Only a member of an organisation can register a new camera'))
		expect(alert.mock.calls[0][1]).not.toContain('could not ask the server')
		expect(mockBleActions.disconnectDevice).toHaveBeenCalled()
	})

	it('says the server could not be asked, when it could not', async () => {
		mockState.authentication.currentOrganisation = null
		deviceService.adoptFromServer.mockResolvedValue({ kind: 'unchecked' })

		await selectCamera()

		expect(alert).toHaveBeenCalledWith('Cannot register this camera', expect.stringContaining(
			'This phone could not ask the server about this camera. If it is already registered, try again with a connection.'))
	})

	it('asks to sign in, and asks the server nothing, when no one is signed in', async () => {
		mockState.authentication.user = null

		await selectCamera()

		expect(deviceService.adoptFromServer).not.toHaveBeenCalled()
		expect(alert).toHaveBeenCalledWith('Not signed in', expect.any(String))
	})

	it('does not ask the server about a camera already on this phone', async () => {
		deviceService.getDeviceByBluetoothId.mockResolvedValue({ id: 'device-here' } as any)

		await selectCamera()

		expect(deviceService.adoptFromServer).not.toHaveBeenCalled()
		expect(deviceService.calculateDeviceStatus).toHaveBeenCalledWith('device-here')
	})
})
