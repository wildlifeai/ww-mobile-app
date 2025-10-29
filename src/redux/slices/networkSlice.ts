/**
 * Network Slice - Manages network connectivity state
 *
 * Features:
 * - Network connectivity tracking
 * - Network type detection (wifi, cellular, none)
 * - Connection history
 * - Offline mode preferences
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { RootState } from "../index"

export interface NetworkState {
	isOnline: boolean
	connectionType: "wifi" | "cellular" | "ethernet" | "none" | "unknown"
	isInternetReachable: boolean | null
	lastOnline: string | null
	offlineModeEnabled: boolean // User preference for offline mode
}

const initialState: NetworkState = {
	isOnline: false,
	connectionType: "unknown",
	isInternetReachable: null,
	lastOnline: null,
	offlineModeEnabled: false,
}

const networkSlice = createSlice({
	name: "network",
	initialState,
	reducers: {
		// Network came online
		networkOnline: (
			state,
			action: PayloadAction<{
				connectionType: NetworkState["connectionType"]
				isInternetReachable: boolean
			}>,
		) => {
			state.isOnline = true
			state.connectionType = action.payload.connectionType
			state.isInternetReachable = action.payload.isInternetReachable
			state.lastOnline = new Date().toISOString()
		},

		// Network went offline
		networkOffline: (state) => {
			state.isOnline = false
			state.connectionType = "none"
			state.isInternetReachable = false
		},

		// Update network connection type
		updateConnectionType: (
			state,
			action: PayloadAction<NetworkState["connectionType"]>,
		) => {
			state.connectionType = action.payload
		},

		// Toggle offline mode preference
		toggleOfflineMode: (state) => {
			state.offlineModeEnabled = !state.offlineModeEnabled
		},

		// Set offline mode preference
		setOfflineMode: (state, action: PayloadAction<boolean>) => {
			state.offlineModeEnabled = action.payload
		},

		// Reset network state
		resetNetworkState: (state) => {
			return initialState
		},
	},
})

// Export actions
export const {
	networkOnline,
	networkOffline,
	updateConnectionType,
	toggleOfflineMode,
	setOfflineMode,
	resetNetworkState,
} = networkSlice.actions

// Selectors
export const selectIsOnline = (state: RootState) => state.network.isOnline
export const selectConnectionType = (state: RootState) =>
	state.network.connectionType
export const selectIsInternetReachable = (state: RootState) =>
	state.network.isInternetReachable
export const selectLastOnline = (state: RootState) => state.network.lastOnline
export const selectOfflineModeEnabled = (state: RootState) =>
	state.network.offlineModeEnabled

// Selector to check if we can sync (online and not in offline mode)
export const selectCanSync = (state: RootState) =>
	state.network.isOnline && !state.network.offlineModeEnabled

export default networkSlice.reducer
