import { PayloadAction, createSlice } from "@reduxjs/toolkit"

interface BleLibState {
	initialized: boolean
	initialLoad: boolean
	error?: Error
}

const initialState: BleLibState = {
	initialized: false,
	initialLoad: true,
}

export const bleLibrarySlice = createSlice({
	name: "bleLibrary",
	initialState: initialState,
	reducers: {
		libStarted: (state) => {
			state.initialLoad = false
			state.initialized = true
			state.error = undefined
		},
		libError: (state, action: PayloadAction<Error>) => {
			state.initialLoad = false
			state.initialized = false
			state.error = action.payload
		},
	},
})

export const { libStarted, libError } = bleLibrarySlice.actions

export default bleLibrarySlice.reducer
