import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface GPSLocation {
    latitude: number
    longitude: number
    altitude: number
    accuracy: number | null
    timestamp: number
}

interface LocationState {
    currentLocation: GPSLocation | null
    isTracking: boolean
    lastUpdated: number | null
}

const initialState: LocationState = {
    currentLocation: null,
    isTracking: false,
    lastUpdated: null
}

const locationSlice = createSlice({
    name: 'location',
    initialState,
    reducers: {
        setLocation: (state, action: PayloadAction<GPSLocation>) => {
            state.currentLocation = action.payload
            state.lastUpdated = action.payload.timestamp
        },
        setIsTracking: (state, action: PayloadAction<boolean>) => {
            state.isTracking = action.payload
        },
        clearLocation: (state) => {
            state.currentLocation = null
            state.lastUpdated = null
        }
    }
})

export const { setLocation, setIsTracking, clearLocation } = locationSlice.actions
export default locationSlice.reducer
