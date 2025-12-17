// Mock for @react-native-community/netinfo

// Define enum values directly to avoid circular imports
const NetInfoStateType = {
	unknown: "unknown",
	none: "none",
	cellular: "cellular",
	wifi: "wifi",
	bluetooth: "bluetooth",
	ethernet: "ethernet",
	wimax: "wimax",
	vpn: "vpn",
	other: "other",
}

const defaultState = {
	type: NetInfoStateType.wifi,
	isConnected: true,
	isInternetReachable: true,
	details: {
		isConnectionExpensive: false,
		ssid: "test-wifi",
		bssid: "test-bssid",
		strength: 100,
		ipAddress: "192.168.1.1",
		subnet: "255.255.255.0",
		frequency: 2400,
		linkSpeed: 150,
		rxLinkSpeed: 150,
		txLinkSpeed: 150,
	},
}

let currentState = defaultState
let listeners: ((state: any) => void)[] = []

const mockUseNetInfo = jest.fn(() => currentState)

const NetInfoMock = {
	fetch: jest.fn(() => Promise.resolve(currentState)),
	addEventListener: jest.fn((listener: (state: any) => void) => {
		listeners.push(listener)
		return () => {
			listeners = listeners.filter((l) => l !== listener)
		}
	}),
	useNetInfo: mockUseNetInfo,
	configure: jest.fn(),
}

// Helper functions for tests
export const __setNetworkState = (state: Partial<any>) => {
	currentState = { ...currentState, ...state }
	listeners.forEach((listener) => listener(currentState))
}

export const __resetNetworkState = () => {
	currentState = defaultState
}

export const __clearListeners = () => {
	listeners = []
}

export default NetInfoMock
export const useNetInfo = mockUseNetInfo
export const fetch = NetInfoMock.fetch
export const addEventListener = NetInfoMock.addEventListener
export const configure = NetInfoMock.configure
export { NetInfoStateType }
