import { PayloadAction, createSlice } from "@reduxjs/toolkit"

// Types for WW Admin functionality - Web Portal Exclusive Architecture
export interface Organisation {
	id: string
	name: string
	description?: string
	created_at: string
	updated_at: string
}

export interface Project {
	id: string
	name: string
	description?: string
	owner_id: string
	organisation_id: string
	created_at: string
	updated_at: string
	is_private: boolean
	member_count?: number
	deployment_count?: number
}

export interface WWAdminState {
	// Cross-organisation project visibility (read-only)
	visibleProjects: Project[]
	currentOrganisation?: Organisation

	// Web portal integration
	webPortalUrl: string

	// Simplified admin permissions for mobile app
	adminPermissions: {
		canViewAllProjects: boolean
		canAccessWebPortal: boolean
	}

	// State management
	isLoading: boolean
	error: string | null
}

const initialState: WWAdminState = {
	visibleProjects: [],
	webPortalUrl:
		process.env.EXPO_PUBLIC_WW_ADMIN_PORTAL_URL ||
		"https://admin.wildlifewatcher.com",
	adminPermissions: {
		canViewAllProjects: false,
		canAccessWebPortal: false,
	},
	isLoading: false,
	error: null,
}

// Helper function to validate WW Admin permissions
const validateWWAdminPermission = (currentUser: any): boolean => {
	return currentUser?.role === "ww_admin"
}

export const wwAdminSlice = createSlice({
	name: "wwAdmin",
	initialState,
	reducers: {
		// Initialize WW Admin permissions for mobile app
		initializeWWAdmin: (state, action: PayloadAction<any>) => {
			const currentUser = action.payload

			if (validateWWAdminPermission(currentUser)) {
				state.adminPermissions = {
					canViewAllProjects: true,
					canAccessWebPortal: true,
				}
				state.error = null
			} else {
				state.adminPermissions = {
					canViewAllProjects: false,
					canAccessWebPortal: false,
				}
				state.error = "Insufficient permissions for WW Admin features"
			}
		},

		// Cross-organisation project visibility (read-only)
		setVisibleProjects: (state, action: PayloadAction<Project[]>) => {
			if (!state.adminPermissions.canViewAllProjects) {
				state.error = "Insufficient permissions to view all projects"
				return
			}

			state.visibleProjects = action.payload
			state.isLoading = false
			state.error = null
		},

		setCurrentOrganisation: (state, action: PayloadAction<Organisation>) => {
			state.currentOrganisation = action.payload
			state.error = null
		},

		// Web portal navigation
		navigateToWebPortal: (state) => {
			if (!state.adminPermissions.canAccessWebPortal) {
				state.error = "Insufficient permissions to access web portal"
				return
			}

			// This action triggers navigation to web portal (handled by middleware/thunk)
			state.error = null
		},

		setWebPortalUrl: (state, action: PayloadAction<string>) => {
			state.webPortalUrl = action.payload
		},

		setAdminPermissions: (
			state,
			action: PayloadAction<{
				canViewAllProjects: boolean
				canAccessWebPortal: boolean
			}>,
		) => {
			state.adminPermissions = action.payload
		},

		setLoading: (state, action: PayloadAction<boolean>) => {
			state.isLoading = action.payload
		},

		setError: (state, action: PayloadAction<string | null>) => {
			state.error = action.payload
			state.isLoading = false
		},

		clearError: (state) => {
			state.error = null
		},
	},
})

export const {
	initializeWWAdmin,
	setVisibleProjects,
	setCurrentOrganisation,
	navigateToWebPortal,
	setWebPortalUrl,
	setAdminPermissions,
	setLoading,
	setError,
	clearError,
} = wwAdminSlice.actions

// Selectors for WW Admin functionality (web-portal exclusive architecture)
export const selectVisibleProjects = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.visibleProjects

export const selectCurrentOrganisation = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.currentOrganisation

export const selectWebPortalUrl = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.webPortalUrl

export const selectWWAdminPermissions = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.adminPermissions

export const selectWWAdminLoading = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.isLoading

export const selectWWAdminError = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.error

// Project visibility selectors
export const selectProjectsByOrganisation =
	(organisationId: string) => (state: { wwAdmin: WWAdminState }) =>
		state.wwAdmin.visibleProjects.filter(
			(project) => project.organisation_id === organisationId,
		)

export const selectPrivateProjects = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.visibleProjects.filter((project) => project.is_private)

export const selectPublicProjects = (state: { wwAdmin: WWAdminState }) =>
	state.wwAdmin.visibleProjects.filter((project) => !project.is_private)

export default wwAdminSlice.reducer
