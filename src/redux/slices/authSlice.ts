import { PayloadAction, createSlice } from "@reduxjs/toolkit"
import { storeDataToStorage } from "../../utils/helpers"

export const AUTH_STORAGE_KEY = "auth"

// Enhanced types for user roles and organisation management
export type UserRole = "ww_admin" | "project_admin" | "project_member"

export interface UserOrganisation {
	id: string
	name: string
	role: UserRole
}

export interface UserProfile {
	first_name?: string
	last_name?: string
	avatar_url?: string
}

export interface User {
	id: string
	email: string
	role: UserRole
	organisation_id: string | null // Default organisation
	profile?: UserProfile
	organisations?: UserOrganisation[]
}

export interface AuthResponse {
	jwt: string
	user: User
	refresh_token?: string
	isPendingConfirmation?: boolean // For email confirmation flow
}

export interface UserPermissions {
	canManageUsers: boolean
	canAccessAllOrganisations: boolean
	canCreateProjects: boolean
	canManageProjects: boolean
	canDeleteProjects: boolean
	canViewProjects: boolean
	canManageDeployments: boolean
	canViewDeployments: boolean
	canManageDevices: boolean
	canViewDevices: boolean
}

type AuthState = {
	token?: string
	refreshToken?: string
	user?: User
	currentOrganisation?: UserOrganisation
	permissions: UserPermissions
	loading: boolean
	initialLoad: boolean
	sessionPersisted: boolean
	profileLoading: boolean
	error?: string
}

// Helper function to calculate permissions based on role and current organisation
const calculatePermissions = (role: UserRole): UserPermissions => {
	switch (role) {
		case "ww_admin":
			return {
				canManageUsers: true,
				canAccessAllOrganisations: true,
				canCreateProjects: true,
				canManageProjects: true,
				canDeleteProjects: true,
				canViewProjects: true,
				canManageDeployments: true,
				canViewDeployments: true,
				canManageDevices: true,
				canViewDevices: true,
			}
		case "project_admin":
			return {
				canManageUsers: false,
				canAccessAllOrganisations: false,
				canCreateProjects: true,
				canManageProjects: true,
				canDeleteProjects: true,
				canViewProjects: true,
				canManageDeployments: true,
				canViewDeployments: true,
				canManageDevices: true,
				canViewDevices: true,
			}
		case "project_member":
			return {
				canManageUsers: false,
				canAccessAllOrganisations: false,
				canCreateProjects: false,
				canManageProjects: false,
				canDeleteProjects: false,
				canViewProjects: true,
				canManageDeployments: true,
				canViewDeployments: true,
				canManageDevices: false,
				canViewDevices: true,
			}
		default:
			return {
				canManageUsers: false,
				canAccessAllOrganisations: false,
				canCreateProjects: false,
				canManageProjects: false,
				canDeleteProjects: false,
				canViewProjects: false,
				canManageDeployments: false,
				canViewDeployments: false,
				canManageDevices: false,
				canViewDevices: false,
			}
	}
}

const emptyPermissions: UserPermissions = {
	canManageUsers: false,
	canAccessAllOrganisations: false,
	canCreateProjects: false,
	canManageProjects: false,
	canDeleteProjects: false,
	canViewProjects: false,
	canManageDeployments: false,
	canViewDeployments: false,
	canManageDevices: false,
	canViewDevices: false,
}

const initialState: AuthState = {
	loading: false,
	initialLoad: true,
	sessionPersisted: false,
	profileLoading: false,
	permissions: emptyPermissions,
}

export const authSlice = createSlice({
	name: "authentication",
	initialState,
	reducers: {
		setCredentials: (state, action: PayloadAction<AuthResponse>) => {
			state.token = action.payload.jwt
			state.refreshToken = action.payload.refresh_token
			
			// Preserve existing role and organisations if the incoming payload omits them
			const newRole = action.payload.user.organisations ? action.payload.user.role : (state.user?.role || action.payload.user.role)
			const newOrgs = action.payload.user.organisations ? action.payload.user.organisations : state.user?.organisations
			const newOrgId = action.payload.user.organisations ? action.payload.user.organisation_id : (state.user?.organisation_id || action.payload.user.organisation_id)

			state.user = {
				...action.payload.user,
				role: newRole,
				organisations: newOrgs,
				organisation_id: newOrgId
			}
			state.loading = false
			state.initialLoad = false
			state.sessionPersisted = true
			state.error = undefined

			// Calculate permissions based on user role
			state.permissions = calculatePermissions(state.user.role)

			// Set current organisation (default or first available)
			if (
				state.user.organisations &&
				state.user.organisations.length > 0
			) {
				// Find default organisation or use first one
				const defaultOrg =
					state.user.organisations.find(
						(org) => org.id === state.user!.organisation_id,
					) || state.user.organisations[0]
				state.currentOrganisation = defaultOrg

				// Update permissions based on role in current organisation
				state.permissions = calculatePermissions(defaultOrg.role)
			}

			storeDataToStorage(AUTH_STORAGE_KEY, { ...action.payload, user: state.user })
		},
		logout: (state) => {
			state.token = undefined
			state.refreshToken = undefined
			state.user = undefined
			state.currentOrganisation = undefined
			state.permissions = emptyPermissions
			state.loading = false
			state.initialLoad = false
			state.sessionPersisted = false
			state.error = undefined
			storeDataToStorage(AUTH_STORAGE_KEY, null)
		},
		setInitialState: (state, action: PayloadAction<AuthResponse | null>) => {
			const payload = action.payload
			if (payload) {
				state.token = payload.jwt
				state.refreshToken = payload.refresh_token
				state.user = payload.user
				state.permissions = calculatePermissions(payload.user.role)
				state.sessionPersisted = true

				// Set current organisation
				if (
					payload.user.organisations &&
					payload.user.organisations.length > 0
				) {
					const defaultOrg =
						payload.user.organisations.find(
							(org) => org.id === payload.user.organisation_id,
						) || payload.user.organisations[0]
					state.currentOrganisation = defaultOrg
					state.permissions = calculatePermissions(defaultOrg.role)
				}
			}
			state.initialLoad = false
		},
		setUserRole: (state, action: PayloadAction<UserRole>) => {
			if (state.user) {
				state.user.role = action.payload
				state.permissions = calculatePermissions(action.payload)
			}
		},
		setCurrentOrganisation: (state, action: PayloadAction<string>) => {
			if (state.user?.organisations) {
				const org = state.user.organisations.find(
					(o) => o.id === action.payload,
				)
				if (org) {
					state.currentOrganisation = org
					state.permissions = calculatePermissions(org.role)
					state.error = undefined
				} else {
					state.error = "Unauthorized organisation access"
				}
			}
		},
		updateUserProfile: (state, action: PayloadAction<UserProfile>) => {
			if (state.user) {
				state.user.profile = {
					...state.user.profile,
					...action.payload,
				}
				// Update storage
				storeDataToStorage(AUTH_STORAGE_KEY, {
					jwt: state.token!,
					user: state.user,
					refresh_token: state.refreshToken,
				})
			}
		},
		setLoading: (state, action: PayloadAction<boolean>) => {
			state.loading = action.payload
		},
		setProfileLoading: (state, action: PayloadAction<boolean>) => {
			state.profileLoading = action.payload
		},
		setOrganisationsAndRole: (state, action: PayloadAction<{ organisations: UserOrganisation[], role: UserRole, organisationId: string | null }>) => {
			if (state.user) {
				state.user.organisations = action.payload.organisations
				state.user.role = action.payload.role
				state.user.organisation_id = action.payload.organisationId
				state.permissions = calculatePermissions(action.payload.role)
				state.profileLoading = false

				if (action.payload.organisations.length > 0) {
					const defaultOrg = action.payload.organisations.find((org) => org.id === action.payload.organisationId) || action.payload.organisations[0]
					state.currentOrganisation = defaultOrg
					state.permissions = calculatePermissions(defaultOrg.role)
				}

				if (state.token) {
					storeDataToStorage(AUTH_STORAGE_KEY, { jwt: state.token, refresh_token: state.refreshToken, user: state.user })
				}
			}
		},
		setError: (state, action: PayloadAction<string | undefined>) => {
			state.error = action.payload
			state.loading = false
		},
	},
})

export const {
	setCredentials,
	logout,
	setInitialState,
	setUserRole,
	setCurrentOrganisation,
	updateUserProfile,
	setLoading,
	setProfileLoading,
	setOrganisationsAndRole,
	setError,
} = authSlice.actions

// Selectors for easy access to auth state
export const selectCurrentUser = (state: { authentication: AuthState }) =>
	state.authentication.user
export const selectUserPermissions = (state: { authentication: AuthState }) =>
	state.authentication.permissions
export const selectCurrentOrganisation = (state: {
	authentication: AuthState
}) => state.authentication.currentOrganisation
export const selectIsAuthenticated = (state: { authentication: AuthState }) =>
	!!state.authentication.token
export const selectIsWWAdmin = (state: { authentication: AuthState }) =>
	state.authentication.user?.role === "ww_admin"
export const selectIsProjectAdmin = (state: { authentication: AuthState }) =>
	state.authentication.user?.role === "project_admin"
export const selectCanManageUsers = (state: { authentication: AuthState }) =>
	state.authentication.permissions.canManageUsers

export default authSlice.reducer
