export type LoginRequest = {
	identifier: string // email or username
	password: string
}

export type RegisterRequest = {
	name: string
	email: string
	password: string
	organization?: string
}

// Re-export the canonical AuthResponse from authSlice for Supabase MVP2
export type {
	AuthResponse,
	User,
	UserRole,
	UserOrganisation,
	UserProfile,
} from "../../slices/authSlice"
