import { Peripheral } from "react-native-ble-manager"

import { PayloadAction, createSlice } from "@reduxjs/toolkit"
import { clearAllDeviceIntervals } from "../../utils/helpers"

// TODO - Implement
export type DeviceMetadata = any

export interface ExtendedPeripheral extends Peripheral {
	lastSeen?: number   // wall-clock ms of the most recent advertisement
	connected: boolean
	signalLost?: boolean
	device: DeviceMetadata
	loading: boolean
	services?: {
		serviceCharacteristic: string
		readCharacteristic: string
		writeCharacteristic: string
	}
	intervals: {
		[x: string]: NodeJS.Timeout | undefined | null
	}
	dfuInProgress?: boolean
}

interface DevicesState {
	[x: string]: ExtendedPeripheral
}

const initialState: DevicesState = {}

export const DEFAULT_PERIPHERAL: (id: string) => ExtendedPeripheral = (
	id: string,
) => ({
	id,
	connected: false,
	device: {},
	loading: false,
	uponUnlock: [],
	intervals: {},
	rssi: 0,
	advertising: {},
	dfuInProgress: false,
})

export const devicesSlice = createSlice({
	name: "devices",
	initialState: initialState,
	reducers: {
		deviceUpdate: (state, action: PayloadAction<ExtendedPeripheral>) => {
			const { id } = action.payload
			const currentPeripheral = state[id] || DEFAULT_PERIPHERAL(id)

			state[id] = {
				...currentPeripheral,
				...action.payload,
			}
		},
		deviceDisconnect: (state, action: PayloadAction<{ id: string }>) => {
			const { id } = action.payload
			clearAllDeviceIntervals(state[id])

			if (state[id]) {
				state[id].connected = false
				state[id].signalLost = true
			} else {
				state[id] = {
					...DEFAULT_PERIPHERAL(id),
					connected: false,
					signalLost: true,
				}
			}
		},
		deviceLoading: (
			state,
			action: PayloadAction<{ id: string; loading: boolean }>,
		) => {
			const { id, loading } = action.payload
			if (state[id]) {
				state[id].loading = loading
			} else {
				state[id] = { ...DEFAULT_PERIPHERAL(id), loading }
			}
		},
		deviceSignalChanged: (
			state,
			action: PayloadAction<{
				data: {
					peripheral: Peripheral
					value: boolean
				}[]
			}>,
		) => {
			const { data } = action.payload

			data.forEach(({ peripheral, value }) => {
				if (state[peripheral.id]) {
					state[peripheral.id].signalLost = value
				} else {
					state[peripheral.id] = {
						...DEFAULT_PERIPHERAL(peripheral.id),
						signalLost: value,
					}
				}
			})
		},
		removeDevice: (state, action: PayloadAction<{ id: string }>) => {
			const { id } = action.payload
			if (state[id]) {
				clearAllDeviceIntervals(state[id])
				delete state[id]
			}
		},
		setDfuStatus: (
			state,
			action: PayloadAction<{ id: string; status: boolean }>,
		) => {
			const { id, status } = action.payload
			if (state[id]) {
				state[id].dfuInProgress = status
			}
		},
		/** Remove all non-connected devices from state (flush stale scan results) */
		clearDiscoveredDevices: (state) => {
			Object.keys(state).forEach(id => {
				if (!state[id].connected) {
					clearAllDeviceIntervals(state[id])
					delete state[id]
				}
			})
		},
	},
})

export const {
	deviceUpdate,
	deviceDisconnect,
	deviceLoading,
	deviceSignalChanged,
	removeDevice,
	setDfuStatus,
	clearDiscoveredDevices,
} = devicesSlice.actions

export default devicesSlice.reducer
