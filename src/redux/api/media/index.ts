import { api } from ".."
import { API_URLS } from "../urls"
import { Media, MediaCreate, MediaUpdate, HttpMethod } from "../types"

export const mediaApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getMedia: builder.query<Media[], void>({
			query: () => ({
				url: API_URLS.MEDIA,
				method: HttpMethod.GET,
			}),
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({
								type: "Media" as const,
								id: id,
							})),
							{ type: "Media", id: "LIST" },
					  ]
					: [{ type: "Media", id: "LIST" }],
		}),

		getMediaById: builder.query<Media, string>({
			query: (id) => ({
				url: API_URLS.MEDIA_BY_ID(id),
				method: HttpMethod.GET,
			}),
			providesTags: (_result, _error, id) => [{ type: "Media", id }],
		}),

		createMedia: builder.mutation<Media, MediaCreate>({
			query: (body) => ({
				url: API_URLS.MEDIA,
				method: HttpMethod.POST,
				body,
			}),
			invalidatesTags: [{ type: "Media", id: "LIST" }],
		}),

		updateMedia: builder.mutation<Media, MediaUpdate>({
			query: (body) => ({
				url: API_URLS.MEDIA,
				method: HttpMethod.PUT,
				body,
			}),
			invalidatesTags: (_result, _error, { id }: MediaUpdate) => [
				{ type: "Media", id },
			],
		}),

		deleteMedia: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.MEDIA_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [{ type: "Media", id }],
		}),
	}),
})
