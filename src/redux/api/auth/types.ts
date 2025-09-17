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

export type AuthResponse = {
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
