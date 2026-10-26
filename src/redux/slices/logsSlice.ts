import { PayloadAction, createSlice } from "@reduxjs/toolkit"

export interface LogEntry {
	timestamp: number
	content: string
	type: "info" | "error" | "rx" | "tx"
}

interface LogsState {
	[deviceId: string]: LogEntry[]
}

const initialState: LogsState = {}

export const logsSlice = createSlice({
	name: "logs",
	initialState: initialState,
	reducers: {
		/**
		 * Appends a new log entry for a device
		 */
		logAdded: (
			state,
			action: PayloadAction<{ id: string; log: LogEntry }>,
		) => {
			const { id, log } = action.payload
			if (!state[id]) {
				state[id] = []
			}
			state[id].push(log)

			// Limit to last 1000 logs to prevent memory issues
			if (state[id].length > 1000) {
				state[id] = state[id].slice(state[id].length - 1000)
			}
		},
		/**
		 * Clears logs for a device
		 */
		clearLogs: (state, action: PayloadAction<{ id: string }>) => {
			const { id } = action.payload
			state[id] = []
		},
	},
})

export const { logAdded, clearLogs } = logsSlice.actions

export default logsSlice.reducer
