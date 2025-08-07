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
		id: number
		username: string
		email: string
		confirmed: boolean
		blocked: boolean
		createdAt: string
		updatedAt: string
	}
}
