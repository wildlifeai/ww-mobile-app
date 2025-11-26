/**
 * Enhanced RTK Query API Integration Layer with Role-Based Security
 * Task 10.4 - API Integration Layer implementation
 */

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { RootState } from "../.."
import { getSupabaseClient } from "../../../services/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

// Enhanced API types with role-based security
export interface APIResponse<T> {
	data?: T
	error?: string
	success: boolean
}

export interface PaginatedResponse<T> {
	data: T[]
	count: number
	page: number
	per_page: number
	total_pages: number
}

// Role-based query parameters
export interface RoleBasedQuery {
	organisation_id?: string
	user_role: "ww_admin" | "project_admin" | "project_member"
	user_id: string
}

// Projects API types
export interface ProjectQuery extends RoleBasedQuery {
	status?: "active" | "archived" | "completed"
	created_by?: string
}

export interface CreateProjectRequest {
	name: string
	description?: string
	organisation_id: string
}

// Deployments API types
export interface DeploymentQuery extends RoleBasedQuery {
	project_id?: string
	status?: "draft" | "active" | "paused" | "completed" | "cancelled"
	include_devices?: boolean
}

export interface CreateDeploymentRequest {
	name: string
	description?: string
	project_id: string
	start_date: string
	end_date?: string
	location: {
		latitude: number
		longitude: number
		address?: string
		notes?: string
	}
}

// WW Admin API types
export interface AdminQuery {
	organisation_id?: string
	user_status?: "pending" | "active" | "suspended"
	role?: "ww_admin" | "project_admin" | "project_member"
}

export interface UserProvisioningRequest {
	email: string
	first_name?: string
	last_name?: string
	role: "ww_admin" | "project_admin" | "project_member"
	organisation_id?: string
}

// LoRaWAN webhook types
export interface LoRaWANWebhookPayload {
	device_id: string
	battery_level: number
	sd_card_usage: number
	signal_strength?: number
	timestamp: string
	device_status: "online" | "offline" | "error"
}

// Enhanced API with role-based security
export const enhancedApi = createApi({
	reducerPath: "enhancedApi",
	baseQuery: fetchBaseQuery({
		baseUrl: "/api/v1",
		prepareHeaders: (headers, { getState }) => {
			const state = getState() as RootState
			const token = state.authentication.token
			const currentOrg = state.authentication.currentOrganisation

			if (token) {
				headers.set("authorization", `Bearer ${token}`)
			}

			if (currentOrg) {
				headers.set("x-organisation-id", currentOrg.id)
			}

			headers.set("content-type", "application/json")
			return headers
		},
	}),
	tagTypes: ["Project", "Deployment", "User", "Organisation", "Device"],
	endpoints: (builder) => ({
		// Projects Endpoints with Role-Based Access
		getProjects: builder.query<PaginatedResponse<any>, ProjectQuery>({
			query: ({ organisation_id, user_role, user_id, status, created_by }) => ({
				url: "/projects",
				params: {
					organisation_id:
						user_role === "ww_admin" ? undefined : organisation_id,
					status,
					created_by: user_role === "project_member" ? user_id : created_by,
					page: 1,
					per_page: 50,
				},
			}),
			providesTags: ["Project"],
			transformResponse: (response: any[], meta) => ({
				data: response,
				count: response.length,
				page: 1,
				per_page: 50,
				total_pages: Math.ceil(response.length / 50),
			}),
		}),

		createProject: builder.mutation<APIResponse<any>, CreateProjectRequest>({
			query: (project) => ({
				url: "/projects",
				method: "POST",
				body: project,
			}),
			invalidatesTags: ["Project"],
			transformResponse: (response: any) => ({
				data: response,
				success: true,
			}),
			transformErrorResponse: (error) => ({
				error: error.data?.message || "Failed to create project",
				success: false,
			}),
		}),

		updateProject: builder.mutation<
			APIResponse<any>,
			{ id: string; updates: Partial<any> }
		>({
			query: ({ id, updates }) => ({
				url: `/projects/${id}`,
				method: "PATCH",
				body: updates,
			}),
			invalidatesTags: ["Project"],
			transformResponse: (response: any) => ({
				data: response,
				success: true,
			}),
		}),

		deleteProject: builder.mutation<APIResponse<void>, string>({
			query: (id) => ({
				url: `/projects/${id}`,
				method: "DELETE",
			}),
			invalidatesTags: ["Project"],
			transformResponse: () => ({
				success: true,
			}),
		}),

		// Deployments Endpoints with LoRaWAN Integration
		getDeployments: builder.query<PaginatedResponse<any>, DeploymentQuery>({
			query: ({
				organisation_id,
				user_role,
				project_id,
				status,
				include_devices,
			}) => ({
				url: "/deployments",
				params: {
					organisation_id:
						user_role === "ww_admin" ? undefined : organisation_id,
					project_id,
					status,
					include_devices,
					page: 1,
					per_page: 50,
				},
			}),
			providesTags: ["Deployment", "Device"],
			transformResponse: (response: any[]) => ({
				data: response,
				count: response.length,
				page: 1,
				per_page: 50,
				total_pages: Math.ceil(response.length / 50),
			}),
		}),

		createDeployment: builder.mutation<
			APIResponse<any>,
			CreateDeploymentRequest
		>({
			query: (deployment) => ({
				url: "/deployments",
				method: "POST",
				body: deployment,
			}),
			invalidatesTags: ["Deployment"],
		}),

		updateDeployment: builder.mutation<
			APIResponse<any>,
			{ id: string; updates: Partial<any> }
		>({
			query: ({ id, updates }) => ({
				url: `/deployments/${id}`,
				method: "PATCH",
				body: updates,
			}),
			invalidatesTags: ["Deployment"],
		}),

		// LoRaWAN Device Status Updates
		updateDeviceStatus: builder.mutation<
			APIResponse<void>,
			LoRaWANWebhookPayload
		>({
			query: (payload) => ({
				url: "/devices/lorawan-status",
				method: "POST",
				body: payload,
			}),
			invalidatesTags: ["Device", "Deployment"],
		}),

		getDeviceStatus: builder.query<any, string>({
			query: (deviceId) => `/devices/${deviceId}/status`,
			providesTags: ["Device"],
		}),

		// WW Admin Endpoints (MVP Feature)
		getOrganisations: builder.query<PaginatedResponse<any>, void>({
			query: () => "/admin/organisations",
			providesTags: ["Organisation"],
			transformResponse: (response: any[]) => ({
				data: response,
				count: response.length,
				page: 1,
				per_page: 50,
				total_pages: Math.ceil(response.length / 50),
			}),
		}),

		createOrganisation: builder.mutation<
			APIResponse<any>,
			{ name: string; description?: string }
		>({
			query: (org) => ({
				url: "/admin/organisations",
				method: "POST",
				body: org,
			}),
			invalidatesTags: ["Organisation"],
		}),

		getUsers: builder.query<PaginatedResponse<any>, AdminQuery>({
			query: ({ organisation_id, user_status, role }) => ({
				url: "/admin/users",
				params: {
					organisation_id,
					status: user_status,
					role,
					page: 1,
					per_page: 50,
				},
			}),
			providesTags: ["User"],
			transformResponse: (response: any[]) => ({
				data: response,
				count: response.length,
				page: 1,
				per_page: 50,
				total_pages: Math.ceil(response.length / 50),
			}),
		}),

		inviteUser: builder.mutation<APIResponse<any>, UserProvisioningRequest>({
			query: (user) => ({
				url: "/admin/users/invite",
				method: "POST",
				body: user,
			}),
			invalidatesTags: ["User"],
		}),

		updateUserStatus: builder.mutation<
			APIResponse<any>,
			{
				id: string
				status: "pending" | "active" | "suspended" | "archived"
			}
		>({
			query: ({ id, status }) => ({
				url: `/admin/users/${id}/status`,
				method: "PATCH",
				body: { status },
			}),
			invalidatesTags: ["User"],
		}),

		// System Metrics for WW Admin
		getSystemMetrics: builder.query<any, void>({
			query: () => "/admin/metrics",
			providesTags: ["Organisation", "User"],
		}),

		// Authentication with Role Detection
		loginUser: builder.mutation<
			APIResponse<any>,
			{ email: string; password: string }
		>({
			query: (credentials) => ({
				url: "/auth/login",
				method: "POST",
				body: credentials,
			}),
			transformResponse: (response: any) => ({
				data: response,
				success: true,
			}),
			transformErrorResponse: (error) => ({
				error: error.data?.message || "Login failed",
				success: false,
			}),
		}),

		refreshToken: builder.mutation<APIResponse<any>, { refresh_token: string }>(
			{
				query: ({ refresh_token }) => ({
					url: "/auth/refresh",
					method: "POST",
					body: { refresh_token },
				}),
			},
		),

		// Real-time subscriptions setup
		setupRealtimeSubscription: builder.query<
			any,
			{ table: string; organisation_id?: string }
		>({
			queryFn: async ({ table, organisation_id }) => {
				try {
					const channel = getSupabaseClient()
						.channel(`realtime-${table}`)
						.on(
							"postgres_changes",
							{
								event: "*",
								schema: "public",
								table,
								filter: organisation_id
									? `organisation_id=eq.${organisation_id}`
									: undefined,
							},
							(
								payload: RealtimePostgresChangesPayload<
									Record<string, unknown>
								>,
							) => {
								// This will trigger cache invalidation
								console.log("Realtime update:", payload)
							},
						)
						.subscribe()

					return { data: { channel, status: "subscribed" } }
				} catch (error) {
					return { error: { status: "SUBSCRIPTION_ERROR", data: error } }
				}
			},
		}),
	}),
})

// Export hooks for components
export const {
	useGetProjectsQuery,
	useCreateProjectMutation,
	useUpdateProjectMutation,
	useDeleteProjectMutation,
	useGetDeploymentsQuery,
	useCreateDeploymentMutation,
	useUpdateDeploymentMutation,
	useUpdateDeviceStatusMutation,
	useGetDeviceStatusQuery,
	useGetOrganisationsQuery,
	useCreateOrganisationMutation,
	useGetUsersQuery,
	useInviteUserMutation,
	useUpdateUserStatusMutation,
	useGetSystemMetricsQuery,
	useLoginUserMutation,
	useRefreshTokenMutation,
	useSetupRealtimeSubscriptionQuery,
} = enhancedApi

// Role-based query helpers
export const createRoleBasedQuery = (state: RootState): RoleBasedQuery => ({
	organisation_id: state.authentication.currentOrganisation?.id,
	user_role: state.authentication.user?.role || "project_member",
	user_id: state.authentication.user?.id || "",
})

export default enhancedApi
