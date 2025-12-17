import { api } from ".."
import { API_URLS } from "../urls"
import {
	Observation,
	ObservationCreate,
	ObservationUpdate,
	HttpMethod,
} from "../types"

export const observationsApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getObservations: builder.query<Observation[], void>({
			query: () => ({
				url: API_URLS.OBSERVATIONS,
				method: HttpMethod.GET,
			}),
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({
								type: "Observation" as const,
								id: id,
							})),
							{ type: "Observation", id: "LIST" },
					  ]
					: [{ type: "Observation", id: "LIST" }],
		}),

		getObservationById: builder.query<Observation, string>({
			query: (id) => ({
				url: API_URLS.OBSERVATION_BY_ID(id),
				method: HttpMethod.GET,
			}),
			providesTags: (_result, _error, id) => [{ type: "Observation", id }],
		}),

		createObservation: builder.mutation<Observation, ObservationCreate>({
			query: (body) => ({
				url: API_URLS.OBSERVATIONS,
				method: HttpMethod.POST,
				body,
			}),
			invalidatesTags: [{ type: "Observation", id: "LIST" }],
		}),

		updateObservation: builder.mutation<
			Observation,
			{ id: string; body: ObservationUpdate }
		>({
			query: ({ id, body }) => ({
				url: API_URLS.OBSERVATION_BY_ID(id),
				method: HttpMethod.PUT,
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: "Observation", id },
				{ type: "Observation", id: "LIST" },
			],
		}),

		deleteObservation: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.OBSERVATION_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "Observation", id },
				{ type: "Observation", id: "LIST" },
			],
		}),
	}),
})

export const {
	useGetObservationsQuery,
	useGetObservationByIdQuery,
	useCreateObservationMutation,
	useUpdateObservationMutation,
	useDeleteObservationMutation,
} = observationsApi
