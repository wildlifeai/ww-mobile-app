import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"

import androidPermissionsReducer from "./slices/androidPermissionsSlice"
import bleLibraryReducer from "./slices/bleLibrarySlice"
import blStatusReducer from "./slices/bluetoothStatusSlice"
import configurationReducer from "./slices/configurationSlice"
import devicesReducer from "./slices/devicesSlice"
import locationStatusReducer from "./slices/locationStatusSlice"
import logsReducer from "./slices/logsSlice"
import scanningReducer from "./slices/scanningSlice"
import authReducer from "./slices/authSlice"
import deploymentsReducer from "./slices/deploymentsSlice"
import wwAdminReducer from "./slices/wwAdminSlice"
import syncReducer from "./slices/syncSlice"
import networkReducer from "./slices/networkSlice"
import { Action, ThunkAction, configureStore } from "@reduxjs/toolkit"
import { api } from "./api"
import { enhancedApi } from "./api/enhanced"
import { projectsApi } from "./api/projectsApi"
import { aiModelsApi } from "./api/aiModelsApi"

const store = configureStore({
	reducer: {
		[api.reducerPath]: api.reducer,
		[enhancedApi.reducerPath]: enhancedApi.reducer,
		[projectsApi.reducerPath]: projectsApi.reducer,
		[aiModelsApi.reducerPath]: aiModelsApi.reducer,
		devices: devicesReducer,
		logs: logsReducer,
		configuration: configurationReducer,
		scanning: scanningReducer,
		bleLibrary: bleLibraryReducer,
		blStatus: blStatusReducer,
		locationStatus: locationStatusReducer,
		androidPermissions: androidPermissionsReducer,
		authentication: authReducer,
		deployments: deploymentsReducer,
		wwAdmin: wwAdminReducer,
		sync: syncReducer,
		network: networkReducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				ignoredActions: ["persist/PERSIST"],
			},
		}).concat(
			api.middleware,
			enhancedApi.middleware,
			projectsApi.middleware,
			aiModelsApi.middleware,
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
