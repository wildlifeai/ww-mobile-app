import { api } from ".."
import { API_URLS } from "../urls"
import {
	Project,
	ProjectCreate,
	ProjectUpdate,
	HttpMethod,
	ApiResponse,
} from "../../types/api.types"

export const projectsApi = api.injectEndpoints({
	endpoints: (builder) => ({
		getProjects: builder.query<Project[], void>({
			query: () => ({
				url: API_URLS.PROJECTS,
				method: HttpMethod.GET,
			}),
			transformResponse: (response: ApiResponse<Project[]>) => response.data,
			providesTags: (_result) =>
				_result
					? [
							..._result.map(({ id }) => ({
								type: "Project" as const,
								id,
							})),
							{ type: "Project", id: "LIST" },
					  ]
					: [{ type: "Project", id: "LIST" }],
		}),

		getProjectById: builder.query<Project, string>({
			query: (id) => ({
				url: API_URLS.PROJECT_BY_ID(id),
				method: HttpMethod.GET,
			}),
			transformResponse: (response: ApiResponse<Project>) => response.data,
			providesTags: (_result, _error, id) => [{ type: "Project", id }],
		}),

		createProject: builder.mutation<Project, StrapiRequest<ProjectCreate>>({
			query: (body) => ({
				url: API_URLS.PROJECTS,
				method: HttpMethod.POST,
				body: { data: body },
			}),
			transformResponse: (response: ApiResponse<Project>) => response.data,
			invalidatesTags: [{ type: "Project", id: "LIST" }],
		}),

		updateProject: builder.mutation<
			Project,
			{ id: string; body: ProjectUpdate }
		>({
			query: ({ id, body }) => ({
				url: API_URLS.PROJECT_BY_ID(id),
				method: HttpMethod.PUT,
				body,
			}),
			transformResponse: (response: ApiResponse<Project>) => response.data,
			invalidatesTags: (_result, _error, { id }) => [
				{ type: "Project", id },
				{ type: "Project", id: "LIST" },
			],
		}),

		deleteProject: builder.mutation<void, string>({
			query: (id) => ({
				url: API_URLS.PROJECT_BY_ID(id),
				method: HttpMethod.DELETE,
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: "Project", id },
				{ type: "Project", id: "LIST" },
			],
		}),
	}),
})

export const {
	useGetProjectsQuery,
	useGetProjectByIdQuery,
	useCreateProjectMutation,
	useUpdateProjectMutation,
	useDeleteProjectMutation,
} = projectsApi
