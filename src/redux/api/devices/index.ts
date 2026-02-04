import { api } from ".."
import { API_URLS } from "../urls"
import { Device, DeviceCreate, DeviceUpdate, HttpMethod } from "../types"
import { log } from '../../../utils/logger'

log("API_URLS: ", API_URLS.DEVICES)
export const devicesApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getDevices: builder.query<Device[], void>({
			query: () => ({
				url: API_URLS.DEVICES,
				method: HttpMethod.GET,
			}),
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({
								type: "Device" as const,
								id: id,
							})),
							{ type: "Device", id: "LIST" },
					  ]
					: [{ type: "Device", id: "LIST" }],
		}),

		getDeviceById: builder.query<Device, string>({
			query: (id) => ({
				url: API_URLS.DEVICE_BY_ID(id),
				method: HttpMethod.GET,
			}),
			providesTags: (_result, _error, id) => [{ type: "Device", id }],
		}),

		createDevice: builder.mutation<Device, DeviceCreate>({
			query: (body) => ({
				url: API_URLS.DEVICES,
				method: HttpMethod.POST,
				body,
			}),
			invalidatesTags: [{ type: "Device", id: "LIST" }],
		}),

		updateDevice: builder.mutation<Device, { id: string; body: DeviceUpdate }>({
			query: ({ id, body }) => ({
				url: API_URLS.DEVICE_BY_ID(id),
				method: HttpMethod.PUT,
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: "Device", id },
				{ type: "Device", id: "LIST" },
			],
		}),

		deleteDevice: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.DEVICE_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "Device", id },
				{ type: "Device", id: "LIST" },
			],
		}),
	}),
})

export const {
	useGetDevicesQuery,
	useGetDeviceByIdQuery,
	useCreateDeviceMutation,
	useUpdateDeviceMutation,
	useDeleteDeviceMutation,
} = devicesApi
