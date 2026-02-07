import authReducer, {
	setCredentials,
	logout,
	setInitialState,
	setUserRole,
	setCurrentOrganisation,
	updateUserProfile,
	selectCurrentUser,
	selectUserPermissions,
	selectIsAuthenticated,
	selectIsProjectAdmin,
	AUTH_STORAGE_KEY,
	UserRole,
	AuthResponse,
} from "../authSlice"
import { storeDataToStorage } from "../../../utils/helpers"

// Mock helper to verify storage calls
jest.mock("../../../utils/helpers", () => ({
	storeDataToStorage: jest.fn(),
}))

describe("authSlice", () => {
	const initialState = {
		loading: false,
		initialLoad: true,
		sessionPersisted: false,
		permissions: {
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
		},
	}

	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		role: "project_admin" as UserRole,
		organisation_id: "org-1",
		organisations: [
			{ id: "org-1", name: "Org 1", role: "project_admin" as UserRole },
			{ id: "org-2", name: "Org 2", role: "project_member" as UserRole },
		],
	}

	const mockAuthResponse: AuthResponse = {
		jwt: "fake-jwt-token",
		user: mockUser,
		refresh_token: "fake-refresh-token",
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should handle initial state", () => {
		expect(authReducer(undefined, { type: "unknown" })).toEqual(initialState)
	})

	describe("Actions", () => {
		it("should handle setCredentials", () => {
			const nextState = authReducer(initialState, setCredentials(mockAuthResponse))

			expect(nextState.token).toBe("fake-jwt-token")
			expect(nextState.user).toEqual(mockUser)
			expect(nextState.sessionPersisted).toBe(true)
			expect(nextState.loading).toBe(false)
			// project_admin permissions should be set
			expect(nextState.permissions.canCreateProjects).toBe(true) 
			expect(nextState.permissions.canManageUsers).toBe(false)

			expect(storeDataToStorage).toHaveBeenCalledWith(AUTH_STORAGE_KEY, mockAuthResponse)
		})

		it("should handle logout", () => {
			const loggedInState = authReducer(initialState, setCredentials(mockAuthResponse))
			const nextState = authReducer(loggedInState, logout())

			expect(nextState.token).toBeUndefined()
			expect(nextState.user).toBeUndefined()
			expect(nextState.sessionPersisted).toBe(false)
			expect(nextState.permissions.canCreateProjects).toBe(false)

			expect(storeDataToStorage).toHaveBeenCalledWith(AUTH_STORAGE_KEY, null)
		})

		it("should handle setInitialState (hydration)", () => {
			const nextState = authReducer(initialState, setInitialState(mockAuthResponse))

			expect(nextState.token).toBe("fake-jwt-token")
			expect(nextState.user).toEqual(mockUser)
			expect(nextState.initialLoad).toBe(false)
			expect(nextState.sessionPersisted).toBe(true)
		})

		it("should handle setInitialState with null (no session)", () => {
			const nextState = authReducer(initialState, setInitialState(null))

			expect(nextState.token).toBeUndefined()
			expect(nextState.initialLoad).toBe(false)
		})

		it("should handle setUserRole", () => {
			let state = authReducer(initialState, setCredentials(mockAuthResponse))
			// Initially project_admin
			expect(state.permissions.canManageUsers).toBe(false)

			// Switch to ww_admin
			state = authReducer(state, setUserRole("ww_admin"))
			expect(state.user?.role).toBe("ww_admin")
			expect(state.permissions.canManageUsers).toBe(true)
		})

		it("should handle setCurrentOrganisation", () => {
			let state = authReducer(initialState, setCredentials(mockAuthResponse))
			// Default is Org 1 (project_admin)
			expect(state.currentOrganisation?.id).toBe("org-1")
			expect(state.permissions.canCreateProjects).toBe(true)

			// Switch to Org 2 (project_member)
			state = authReducer(state, setCurrentOrganisation("org-2"))
			expect(state.currentOrganisation?.id).toBe("org-2")
			// project_member cannot create projects
			expect(state.permissions.canCreateProjects).toBe(false)
		})
		
		it("should fail to set invalid organisation", () => {
			let state = authReducer(initialState, setCredentials(mockAuthResponse))
			state = authReducer(state, setCurrentOrganisation("invalid-org"))
			
			expect(state.currentOrganisation?.id).toBe("org-1") // Should remain unchanged
			expect(state.error).toBe("Unauthorized organisation access")
		})

		it("should handle updateUserProfile", () => {
			let state = authReducer(initialState, setCredentials(mockAuthResponse))
			
			const profileUpdate = { first_name: "John", last_name: "Doe" }
			state = authReducer(state, updateUserProfile(profileUpdate))

			expect(state.user?.profile?.first_name).toBe("John")
			
			// Should verify storage update too
			expect(storeDataToStorage).toHaveBeenCalled()
		})
	})

	describe("Selectors", () => {
		const state = {
			authentication: authReducer(initialState, setCredentials(mockAuthResponse))
		}

		it("selectCurrentUser should return user", () => {
			expect(selectCurrentUser(state)).toEqual(mockUser)
		})

		it("selectIsAuthenticated should return true", () => {
			expect(selectIsAuthenticated(state)).toBe(true)
		})

		it("selectIsProjectAdmin should return true for project_admin", () => {
			expect(selectIsProjectAdmin(state)).toBe(true)
		})
		
		it("selectUserPermissions should return permissions", () => {
			expect(selectUserPermissions(state).canCreateProjects).toBe(true)
		})
	})
})
