import { PayloadAction, createSlice } from "@reduxjs/toolkit"

interface ScanningState {
	isScanning: boolean
	isEngineerConsoleActive: boolean
	error?: Error
}

const initialState: ScanningState = {
	isScanning: false,
	isEngineerConsoleActive: false,
}

export const scanningSlice = createSlice({
	name: "scanning",
	initialState: initialState,
	reducers: {
		scanStart: (state) => {
			state.isScanning = true
			state.error = undefined
		},
		scanStop: (state) => {
			state.isScanning = false
			state.error = undefined
		},
		scanError: (state, action: PayloadAction<Error>) => {
			state.error = action.payload
		},
		setEngineerConsoleActive: (state, action: PayloadAction<boolean>) => {
			state.isEngineerConsoleActive = action.payload
		},
	},
})

export const { scanStart, scanStop, scanError, setEngineerConsoleActive } = scanningSlice.actions

export default scanningSlice.reducer
