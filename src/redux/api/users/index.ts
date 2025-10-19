import { API_URLS } from "../urls"
import { User, UserCreate, UserUpdate, HttpMethod } from "../types"
import { api } from ".."

export const usersApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getUsers: builder.query<User[], void>({
			query: () => ({
				url: API_URLS.USERS,
				method: HttpMethod.GET,
			}),
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({ type: "User" as const, id: id })),
							{ type: "User", id: "LIST" },
					  ]
					: [{ type: "User", id: "LIST" }],
		}),

		getUserById: builder.query<User, string>({
			query: (id) => ({
				url: API_URLS.USER_BY_ID(id),
				method: HttpMethod.GET,
			}),
			providesTags: (_result, _error, id) => [{ type: "User", id }],
		}),

		createUser: builder.mutation<User, UserCreate>({
			query: (body) => ({
				url: API_URLS.USERS,
				method: HttpMethod.POST,
				body,
			}),
			invalidatesTags: [{ type: "User", id: "LIST" }],
		}),

		updateUser: builder.mutation<User, { id: string; body: UserUpdate }>({
			query: ({ id, body }) => ({
				url: API_URLS.USER_BY_ID(id),
				method: HttpMethod.PUT,
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: "User", id },
				{ type: "User", id: "LIST" },
			],
		}),

		deleteUser: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.USER_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "User", id },
				{ type: "User", id: "LIST" },
			],
		}),
	}),
})

export const {
	useGetUsersQuery,
	useGetUserByIdQuery,
	useCreateUserMutation,
	useUpdateUserMutation,
	useDeleteUserMutation,
} = usersApi
