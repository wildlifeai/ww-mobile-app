import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"

import androidPermissionsReducer from "./slices/androidPermissionsSlice"
import bleLibraryReducer from "./slices/bleLibrarySlice"
import blStatusReducer from "./slices/bluetoothStatusSlice"
import devicesReducer from "./slices/devicesSlice"
import locationStatusReducer from "./slices/locationStatusSlice"
import logsReducer from "./slices/logsSlice"
import scanningReducer from "./slices/scanningSlice"
import authReducer from "./slices/authSlice"
import deploymentsReducer from "./slices/deploymentsSlice"
import syncReducer from "./slices/syncSlice"
import locationReducer from "./slices/locationSlice"
import { Action, ThunkAction, configureStore } from "@reduxjs/toolkit"
import { api } from "./api"
import { projectsApi } from "./api/projectsApi"

const store = configureStore({
	reducer: {
		[api.reducerPath]: api.reducer,
		[projectsApi.reducerPath]: projectsApi.reducer,
		devices: devicesReducer,
		logs: logsReducer,
		scanning: scanningReducer,
		bleLibrary: bleLibraryReducer,
		blStatus: blStatusReducer,
		locationStatus: locationStatusReducer,
		androidPermissions: androidPermissionsReducer,
		authentication: authReducer,
		deployments: deploymentsReducer,
		sync: syncReducer,
		location: locationReducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				ignoredActions: ["persist/PERSIST"],
			},
			immutableCheck: { warnAfter: 1000 },
		}).concat(
			api.middleware,
			projectsApi.middleware,
		),
})

export default store

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

export type AppThunk<ReturnType = void> = ThunkAction<
	ReturnType,
	RootState,
	unknown,
	Action
>
