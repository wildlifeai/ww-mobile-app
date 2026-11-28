import { renderHook, waitFor } from '@testing-library/react-native'

import { useDeviceDiscovery } from '../useDeviceDiscovery'

/**
 * #575: "Connect to <camera>" on a deployment page opened the Scanner idle, so
 * the user tapped Search for Devices as well. It now opens with autoScan, and
 * the Scanner starts the search once on arrival. The Scanner tab, with no
 * autoScan, still waits for the tap.
 */

const mockState = {
	devices: {},
	scanning: { isEngineerConsoleActive: false },
	authentication: { user: { id: 'user-1' }, currentOrganisation: { id: 'org-1' } },
	sync: { hasCompletedInitialSync: true, isGlobalSyncing: false },
}
const mockNavigation = { navigate: jest.fn(), isFocused: jest.fn(() => true) }
const mockBleActions = {
	isBleConnecting: false,
	stopScan: jest.fn(async () => {}),
	connectDevice: jest.fn(),
	disconnectDevice: jest.fn(async () => {}),
}
const mockAutoConnect = { resetAll: jest.fn(), transition: jest.fn(), canAutoConnect: jest.fn(() => true), resetDevice: jest.fn() }
const mockFlushBleCache = jest.fn(async () => {})

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
jest.mock('../../../../hooks/useDevicePreDeploymentChecks', () => ({ useDevicePreDeploymentChecks: () => ({ runChecks: jest.fn() }) }))
jest.mock('../../../../hooks/useBleInitialization', () => ({ useBleInitialization: () => ({ initialize: jest.fn() }) }))
jest.mock('../../../../services/DeviceService', () => ({ DeviceService: {} }))
jest.mock('../../../../services/DeploymentService', () => ({ DeploymentService: {} }))
jest.mock('../../../../services/ProjectService', () => ({ __esModule: true, default: {} }))
jest.mock('../useAutoConnectStateMachine', () => ({ useAutoConnectStateMachine: () => mockAutoConnect }))
jest.mock('../../../../hooks/useScanLoop', () => ({ useScanLoop: () => ({ isScanning: false, flushBleCache: mockFlushBleCache }) }))
jest.mock('../../../../services/SyncBarrier', () => ({ waitForInitialSync: jest.fn() }))
jest.mock('../../../../utils/helpers', () => ({ sleep: jest.fn(async () => {}), isDfuBootloader: () => false }))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

describe('the Scanner opened to connect (#575)', () => {
	beforeEach(() => jest.clearAllMocks())

	it('starts the search on arrival, once', async () => {
		const { result, rerender } = renderHook(() => useDeviceDiscovery({ autoScan: true }))

		await waitFor(() => expect(result.current.scanSessionState).toBe('active'))
		rerender({})
		expect(mockFlushBleCache).toHaveBeenCalledTimes(1)
	})

	it('waits for Search for Devices without it', async () => {
		const { result } = renderHook(() => useDeviceDiscovery())

		await waitFor(() => expect(result.current.scanSessionState).toBe('idle'))
		expect(mockFlushBleCache).not.toHaveBeenCalled()
	})
})
