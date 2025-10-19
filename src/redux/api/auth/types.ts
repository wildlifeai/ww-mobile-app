export type LoginRequest = {
	identifier: string // email or username
	password: string
}

export type RegisterRequest = {
	username: string
	email: string
	password: string
	organization?: string
}

// Legacy Strapi AuthResponse - deprecated, use AuthResponse from authSlice instead
export type LegacyAuthResponse = {
	jwt: string
	user: {
		id: string
		username: string
		email: string
		confirmed: boolean
		blocked: boolean
		createdAt: string
		updatedAt: string
	}
	isPendingConfirmation?: boolean // Added for email confirmation flow
}

// Re-export the canonical AuthResponse from authSlice for Supabase MVP2
export type { AuthResponse, User, UserRole, UserOrganisation, UserProfile } from "../../slices/authSlice"
