import { renderHook, act } from '@testing-library/react-native'

import { useDeviceDiscovery } from '../useDeviceDiscovery'
import { DeploymentService } from '../../../../services/DeploymentService'

/**
 * #448 adds a server check to Start Monitoring, for an open deployment this
 * phone does not hold. One the phone does hold keeps its own route: the
 * scanner sends the camera to End Deployment, and the server is not asked.
 */

const mockState = {
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
const mockInitialize = jest.fn(async () => ({ errors: {} }))
const mockRunChecks = jest.fn()

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
jest.mock('../../../../hooks/useBleInitialization', () => ({ useBleInitialization: () => ({ initialize: mockInitialize }) }))
jest.mock('../../../../services/DeviceService', () => ({
	DeviceService: {
		getDeviceByBluetoothId: jest.fn(async () => ({ id: 'device-1' })),
		calculateDeviceStatus: jest.fn(async () => 'deployed'),
	},
}))
jest.mock('../../../../services/DeploymentService', () => ({
	DeploymentService: {
		getActiveDeploymentForDeviceId: jest.fn(async () => ({ id: 'dep-local', projectId: 'project-1' })),
		checkServerForOpenDeployment: jest.fn(),
	},
}))
jest.mock('../../../../services/ProjectService', () => ({
	__esModule: true,
	default: { getProjectById: jest.fn(async () => ({ id: 'project-1' })) },
}))
jest.mock('../useAutoConnectStateMachine', () => ({ useAutoConnectStateMachine: () => mockAutoConnect }))
jest.mock('../../../../hooks/useScanLoop', () => ({ useScanLoop: () => ({ isScanning: false, flushBleCache: jest.fn() }) }))
jest.mock('../../../../services/SyncBarrier', () => ({ waitForInitialSync: jest.fn() }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}) }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

describe('the scanner and an open deployment on this phone (#448)', () => {
	it('still routes the camera to End Deployment, without asking the server', async () => {
		const { result } = renderHook(() => useDeviceDiscovery())

		await act(async () => {
			await result.current.handleDeviceSelect({ id: 'ble-1', name: 'WILD-TEST' } as any)
		})

		expect(mockNavigation.navigate).toHaveBeenCalledWith('StopMonitoringDetailsStep', expect.objectContaining({
			deploymentId: 'dep-local',
			deviceId: 'device-1',
		}))
		expect(mockNavigation.navigate).not.toHaveBeenCalledWith('StartMonitoringDetailsStep', expect.anything())
		expect(DeploymentService.checkServerForOpenDeployment).not.toHaveBeenCalled()
		expect(mockRunChecks).not.toHaveBeenCalled()
	})
})
