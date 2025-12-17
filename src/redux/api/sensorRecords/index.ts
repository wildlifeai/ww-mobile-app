import { api } from ".."
import { API_URLS } from "../urls"
import {
	SensorRecord,
	SensorRecordCreate,
	SensorRecordUpdate,
	HttpMethod,
} from "../types"

export const sensorRecordsApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getSensorRecords: builder.query<SensorRecord[], void>({
			query: () => ({
				url: API_URLS.SENSOR_RECORDS,
				method: HttpMethod.GET,
			}),
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({
								type: "SensorRecord" as const,
								id: id,
							})),
							{ type: "SensorRecord", id: "LIST" },
					  ]
					: [{ type: "SensorRecord", id: "LIST" }],
		}),

		getSensorRecordById: builder.query<SensorRecord, string>({
			query: (id) => ({
				url: API_URLS.SENSOR_RECORD_BY_ID(id),
				method: HttpMethod.GET,
			}),
			providesTags: (_result, _error, id) => [{ type: "SensorRecord", id }],
		}),

		createSensorRecord: builder.mutation<SensorRecord, SensorRecordCreate>({
			query: (body) => ({
				url: API_URLS.SENSOR_RECORDS,
				method: HttpMethod.POST,
				body,
			}),
			invalidatesTags: [{ type: "SensorRecord", id: "LIST" }],
		}),

		updateSensorRecord: builder.mutation<
			SensorRecord,
			{ id: string; body: SensorRecordUpdate }
		>({
			query: ({ id, body }) => ({
				url: API_URLS.SENSOR_RECORD_BY_ID(id),
				method: HttpMethod.PUT,
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: "SensorRecord", id },
				{ type: "SensorRecord", id: "LIST" },
			],
		}),

		deleteSensorRecord: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.SENSOR_RECORD_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "SensorRecord", id },
				{ type: "SensorRecord", id: "LIST" },
			],
		}),
	}),
})

export const {
	useGetSensorRecordsQuery,
	useGetSensorRecordByIdQuery,
	useCreateSensorRecordMutation,
	useUpdateSensorRecordMutation,
	useDeleteSensorRecordMutation,
} = sensorRecordsApi
