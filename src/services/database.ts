import { supabase } from "./supabase"
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase"

/**
 * Database Operations Service
 *
 * Provides typed database operations for the main Wildlife Watcher entities.
 * Demonstrates proper usage of Supabase client with full type safety.
 */

// User Operations
export const userOperations = {
	/**
	 * Get current user profile
	 */
	getCurrentProfile: async (): Promise<Tables<"users"> | null> => {
		const {
			data: { user },
		} = await supabase.auth.getUser()
		if (!user) return null

		const { data, error } = await supabase
			.from("users")
			.select("*")
			.eq("id", user.id)
			.maybeSingle() // Use maybeSingle() instead of single() to handle 0 rows gracefully

		if (error) {
			console.error("Error fetching user profile:", error)
			throw new Error(error.message)
		}

		return data // Will be null if no profile exists
	},

	/**
	 * Create user profile (usually called after registration)
	 */
	createProfile: async (
		profileData: Omit<TablesInsert<"users">, "id">,
	): Promise<Tables<"users">> => {
		const {
			data: { user },
		} = await supabase.auth.getUser()
		if (!user) throw new Error("No authenticated user")

		const { data, error } = await supabase
			.from("users")
			.insert({
				id: user.id, // Use the auth user's UUID
				...profileData,
			})
			.select("*")
			.single()

		if (error) {
			console.error("Error creating user profile:", error)
			throw new Error(error.message)
		}

		return data
	},

	/**
	 * Update user profile
	 */
	updateProfile: async (
		updates: TablesUpdate<"users">,
	): Promise<Tables<"users">> => {
		const {
			data: { user },
		} = await supabase.auth.getUser()
		if (!user) throw new Error("No authenticated user")

		const { data, error } = await supabase
			.from("users")
			.update(updates)
			.eq("id", user.id)
			.select("*")
			.single()

		if (error) {
			console.error("Error updating user profile:", error)
			throw new Error(error.message)
		}

		return data
	},
}

// Device Operations
export const deviceOperations = {
	/**
	 * Get all devices accessible to current user
	 */
	getDevices: async (): Promise<Tables<"devices">[]> => {
		const { data, error } = await supabase
			.from("devices")
			.select("*")
			.order("created_at", { ascending: false })

		if (error) {
			console.error("Error fetching devices:", error)
			throw new Error(error.message)
		}

		return data || []
	},

	/**
	 * Get device by ID
	 */
	getDevice: async (deviceId: string): Promise<Tables<"devices"> | null> => {
		const { data, error } = await supabase
			.from("devices")
			.select("*")
			.eq("id", deviceId)
			.single()

		if (error) {
			console.error("Error fetching device:", error)
			throw new Error(error.message)
		}

		return data
	},

	/**
	 * Create new device
	 */
	createDevice: async (
		device: TablesInsert<"devices">,
	): Promise<Tables<"devices">> => {
		const { data, error } = await supabase
			.from("devices")
			.insert(device)
			.select("*")
			.single()

		if (error) {
			console.error("Error creating device:", error)
			throw new Error(error.message)
		}

		return data
	},

	/**
	 * Update device
	 */
	updateDevice: async (
		deviceId: string,
		updates: TablesUpdate<"devices">,
	): Promise<Tables<"devices">> => {
		const { data, error } = await supabase
			.from("devices")
			.update(updates)
			.eq("id", deviceId)
			.select("*")
			.single()

		if (error) {
			console.error("Error updating device:", error)
			throw new Error(error.message)
		}

		return data
	},
}

// Project Operations
export const projectOperations = {
	/**
	 * Get all projects accessible to current user
	 */
	getProjects: async (): Promise<Tables<"projects">[]> => {
		const { data, error } = await supabase
			.from("projects")
			.select("*")
			.order("created_at", { ascending: false })

		if (error) {
			console.error("Error fetching projects:", error)
			throw new Error(error.message)
		}

		return data || []
	},

	/**
	 * Get project by ID with related data
	 */
	getProject: async (projectId: string): Promise<any> => {
		const { data, error } = await supabase
			.from("projects")
			.select(
				`
        *,
        project_members(
          *,
          users(name)
        ),
        deployments(
          *,
          devices(*)
        )
      `,
			)
			.eq("id", projectId)
			.single()

		if (error) {
			console.error("Error fetching project:", error)
			throw new Error(error.message)
		}

		return data
	},

	/**
	 * Create new project
	 */
	createProject: async (
		project: TablesInsert<"projects">,
	): Promise<Tables<"projects">> => {
		const { data, error } = await supabase
			.from("projects")
			.insert(project)
			.select("*")
			.single()

		if (error) {
			console.error("Error creating project:", error)
			throw new Error(error.message)
		}

		return data
	},
}

// Deployment Operations
export const deploymentOperations = {
	/**
	 * Get deployments for a project
	 */
	getProjectDeployments: async (projectId: string): Promise<any[]> => {
		const { data, error } = await supabase
			.from("deployments")
			.select(
				`
        *,
        devices(*),
        capture_methods(*),
        deployment_statuses(*)
      `,
			)
			.eq("project_id", projectId)
			.order("created_at", { ascending: false })

		if (error) {
			console.error("Error fetching deployments:", error)
			throw new Error(error.message)
		}

		return data || []
	},

	/**
	 * Create new deployment
	 */
	createDeployment: async (
		deployment: TablesInsert<"deployments">,
	): Promise<Tables<"deployments">> => {
		const { data, error } = await supabase
			.from("deployments")
			.insert(deployment)
			.select("*")
			.single()

		if (error) {
			console.error("Error creating deployment:", error)
			throw new Error(error.message)
		}

		return data
	},

	/**
	 * Update deployment
	 */
	updateDeployment: async (
		deploymentId: string,
		updates: TablesUpdate<"deployments">,
	): Promise<Tables<"deployments">> => {
		const { data, error } = await supabase
			.from("deployments")
			.update(updates)
			.eq("id", deploymentId)
			.select("*")
			.single()

		if (error) {
			console.error("Error updating deployment:", error)
			throw new Error(error.message)
		}

		return data
	},
}

// Real-time Subscriptions
export const subscriptions = {
	/**
	 * Subscribe to device changes
	 */
	subscribeToDevices: (callback: (payload: any) => void) => {
		const channel = supabase
			.channel("devices_changes")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "devices" },
				callback,
			)
			.subscribe()

		return () => channel.unsubscribe()
	},

	/**
	 * Subscribe to deployment changes for a project
	 */
	subscribeToProjectDeployments: (
		projectId: string,
		callback: (payload: any) => void,
	) => {
		const channel = supabase
			.channel(`project_${projectId}_deployments`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "deployments",
					filter: `project_id=eq.${projectId}`,
				},
				callback,
			)
			.subscribe()

		return () => channel.unsubscribe()
	},

	/**
	 * Subscribe to project changes
	 */
	subscribeToProjects: (callback: (payload: any) => void) => {
		const channel = supabase
			.channel("projects_changes")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "projects" },
				callback,
			)
			.subscribe()

		return () => channel.unsubscribe()
	},
}

// Reference Data Operations
export const referenceData = {
	/**
	 * Get all roles
	 */
	getRoles: async (): Promise<Tables<"roles">[]> => {
		const { data, error } = await supabase
			.from("roles")
			.select("*")
			.order("value")

		if (error) {
			console.error("Error fetching roles:", error)
			throw new Error(error.message)
		}

		return data || []
	},

	/**
	 * Get all capture methods
	 */
	getCaptureMethods: async (): Promise<Tables<"capture_methods">[]> => {
		const { data, error } = await supabase
			.from("capture_methods")
			.select("*")
			.order("value")

		if (error) {
			console.error("Error fetching capture methods:", error)
			throw new Error(error.message)
		}

		return data || []
	},

	/**
	 * Get all deployment statuses
	 */
	getDeploymentStatuses: async (): Promise<Tables<"deployment_statuses">[]> => {
		const { data, error } = await supabase
			.from("deployment_statuses")
			.select("*")
			.order("value")

		if (error) {
			console.error("Error fetching deployment statuses:", error)
			throw new Error(error.message)
		}

		return data || []
	},
}
