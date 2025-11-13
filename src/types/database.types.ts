export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[]

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: "12.2.12 (cd3cf9e)"
	}
	graphql_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			graphql: {
				Args: {
					extensions?: Json
					operationName?: string
					query?: string
					variables?: Json
				}
				Returns: Json
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
	public: {
		Tables: {
			api_logs: {
				Row: {
					api_endpoint: string | null
					created_at: string | null
					deployment_id: string | null
					device_id: string | null
					id: number
					log_level_id: number | null
					log_message: string | null
					project_id: string | null
					user_id: string | null
				}
				Insert: {
					api_endpoint?: string | null
					created_at?: string | null
					deployment_id?: string | null
					device_id?: string | null
					id?: number
					log_level_id?: number | null
					log_message?: string | null
					project_id?: string | null
					user_id?: string | null
				}
				Update: {
					api_endpoint?: string | null
					created_at?: string | null
					deployment_id?: string | null
					device_id?: string | null
					id?: number
					log_level_id?: number | null
					log_message?: string | null
					project_id?: string | null
					user_id?: string | null
				}
				Relationships: [
					{
						foreignKeyName: "fk_api_logs_deployment"
						columns: ["deployment_id"]
						isOneToOne: false
						referencedRelation: "deployments"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_api_logs_device"
						columns: ["device_id"]
						isOneToOne: false
						referencedRelation: "devices"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_api_logs_log_level"
						columns: ["log_level_id"]
						isOneToOne: false
						referencedRelation: "log_levels"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_api_logs_project"
						columns: ["project_id"]
						isOneToOne: false
						referencedRelation: "projects"
						referencedColumns: ["id"]
					},
				]
			}
			capture_methods: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					description: string
					id: number
					updated_at: string | null
					value: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					description: string
					id?: number
					updated_at?: string | null
					value: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					description?: string
					id?: number
					updated_at?: string | null
					value?: string
				}
				Relationships: []
			}
			deployment_statuses: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					description: string
					id: number
					updated_at: string | null
					value: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					description: string
					id?: number
					updated_at?: string | null
					value: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					description?: string
					id?: number
					updated_at?: string | null
					value?: string
				}
				Relationships: []
			}
			deployments: {
				Row: {
					camera_location_description: string | null
					camera_location_image_path: string | null
					capture_method_id: number | null
					created_at: string | null
					deleted_at: string | null
					deployment_comments: string | null
					deployment_end: string | null
					deployment_photos: Json | null
					deployment_start: string | null
					deployment_status_id: number | null
					device_id: string
					id: string
					latitude: number | null
					location: unknown | null
					location_name: string
					longitude: number | null
					name: string | null
					project_id: string
					updated_at: string | null
					user_id: string
				}
				Insert: {
					camera_location_description?: string | null
					camera_location_image_path?: string | null
					capture_method_id?: number | null
					created_at?: string | null
					deleted_at?: string | null
					deployment_comments?: string | null
					deployment_end?: string | null
					deployment_photos?: Json | null
					deployment_start?: string | null
					deployment_status_id?: number | null
					device_id: string
					id?: string
					latitude?: number | null
					location?: unknown | null
					location_name: string
					longitude?: number | null
					name?: string | null
					project_id: string
					updated_at?: string | null
					user_id: string
				}
				Update: {
					camera_location_description?: string | null
					camera_location_image_path?: string | null
					capture_method_id?: number | null
					created_at?: string | null
					deleted_at?: string | null
					deployment_comments?: string | null
					deployment_end?: string | null
					deployment_photos?: Json | null
					deployment_start?: string | null
					deployment_status_id?: number | null
					device_id?: string
					id?: string
					latitude?: number | null
					location?: unknown | null
					location_name?: string
					longitude?: number | null
					name?: string | null
					project_id?: string
					updated_at?: string | null
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "fk_deployments_capture_method"
						columns: ["capture_method_id"]
						isOneToOne: false
						referencedRelation: "capture_methods"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_deployments_deployment_status"
						columns: ["deployment_status_id"]
						isOneToOne: false
						referencedRelation: "deployment_statuses"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_deployments_device"
						columns: ["device_id"]
						isOneToOne: false
						referencedRelation: "devices"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_deployments_project"
						columns: ["project_id"]
						isOneToOne: false
						referencedRelation: "projects"
						referencedColumns: ["id"]
					},
				]
			}
			devices: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					device_ref_identifier: string | null
					firmware_name: string | null
					id: string
					model: string | null
					updated_at: string | null
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					device_ref_identifier?: string | null
					firmware_name?: string | null
					id?: string
					model?: string | null
					updated_at?: string | null
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					device_ref_identifier?: string | null
					firmware_name?: string | null
					id?: string
					model?: string | null
					updated_at?: string | null
				}
				Relationships: []
			}
			log_levels: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					description: string
					id: number
					updated_at: string | null
					value: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					description: string
					id?: number
					updated_at?: string | null
					value: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					description?: string
					id?: number
					updated_at?: string | null
					value?: string
				}
				Relationships: []
			}
			organisations: {
				Row: {
					created_at: string | null
					created_by: string
					deleted_at: string | null
					id: string
					is_active: boolean
					metadata: Json
					name: string
					slug: string
					updated_at: string | null
				}
				Insert: {
					created_at?: string | null
					created_by: string
					deleted_at?: string | null
					id?: string
					is_active?: boolean
					metadata?: Json
					name: string
					slug: string
					updated_at?: string | null
				}
				Update: {
					created_at?: string | null
					created_by?: string
					deleted_at?: string | null
					id?: string
					is_active?: boolean
					metadata?: Json
					name?: string
					slug?: string
					updated_at?: string | null
				}
				Relationships: []
			}
			project_members: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					project_id: string
					role_id: number | null
					updated_at: string | null
					user_id: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					project_id: string
					role_id?: number | null
					updated_at?: string | null
					user_id: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					project_id?: string
					role_id?: number | null
					updated_at?: string | null
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "fk_project_members_project"
						columns: ["project_id"]
						isOneToOne: false
						referencedRelation: "projects"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "fk_project_members_role"
						columns: ["role_id"]
						isOneToOne: false
						referencedRelation: "roles"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "project_members_project_id_fkey"
						columns: ["project_id"]
						isOneToOne: false
						referencedRelation: "projects"
						referencedColumns: ["id"]
					},
					{
						foreignKeyName: "project_members_role_id_fkey"
						columns: ["role_id"]
						isOneToOne: false
						referencedRelation: "roles"
						referencedColumns: ["id"]
					},
				]
			}
			projects: {
				Row: {
					created_at: string | null
					created_by: string | null
					deleted_at: string | null
					description: string | null
					end_date: string | null
					id: string
					is_baited: boolean | null
					is_monitoring_marked_individual: boolean | null
					is_private: boolean | null
					name: string
					organisation_id: string
					owner_id: string | null
					privacy_level: string
					project_image: string | null
					sampling_design: string | null
					updated_at: string | null
					website: string | null
				}
				Insert: {
					created_at?: string | null
					created_by?: string | null
					deleted_at?: string | null
					description?: string | null
					end_date?: string | null
					id?: string
					is_baited?: boolean | null
					is_monitoring_marked_individual?: boolean | null
					is_private?: boolean | null
					name: string
					organisation_id: string
					owner_id?: string | null
					privacy_level?: string
					project_image?: string | null
					sampling_design?: string | null
					updated_at?: string | null
					website?: string | null
				}
				Update: {
					created_at?: string | null
					created_by?: string | null
					deleted_at?: string | null
					description?: string | null
					end_date?: string | null
					id?: string
					is_baited?: boolean | null
					is_monitoring_marked_individual?: boolean | null
					is_private?: boolean | null
					name?: string
					organisation_id?: string
					owner_id?: string | null
					privacy_level?: string
					project_image?: string | null
					sampling_design?: string | null
					updated_at?: string | null
					website?: string | null
				}
				Relationships: [
					{
						foreignKeyName: "projects_organisation_id_fkey"
						columns: ["organisation_id"]
						isOneToOne: false
						referencedRelation: "organisations"
						referencedColumns: ["id"]
					},
				]
			}
			roles: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					description: string
					id: number
					updated_at: string | null
					value: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					description: string
					id?: number
					updated_at?: string | null
					value: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					description?: string
					id?: number
					updated_at?: string | null
					value?: string
				}
				Relationships: []
			}
			user_organisations: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					id: string
					organisation_id: string
					updated_at: string | null
					user_id: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					id?: string
					organisation_id: string
					updated_at?: string | null
					user_id: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					id?: string
					organisation_id?: string
					updated_at?: string | null
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: "user_organisations_organisation_id_fkey"
						columns: ["organisation_id"]
						isOneToOne: false
						referencedRelation: "organisations"
						referencedColumns: ["id"]
					},
				]
			}
			user_roles: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					expires_at: string | null
					granted_at: string
					granted_by: string | null
					id: string
					is_active: boolean
					role: string
					scope_id: string | null
					scope_type: string
					updated_at: string | null
					user_id: string
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					expires_at?: string | null
					granted_at?: string
					granted_by?: string | null
					id?: string
					is_active?: boolean
					role: string
					scope_id?: string | null
					scope_type: string
					updated_at?: string | null
					user_id: string
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					expires_at?: string | null
					granted_at?: string
					granted_by?: string | null
					id?: string
					is_active?: boolean
					role?: string
					scope_id?: string | null
					scope_type?: string
					updated_at?: string | null
					user_id?: string
				}
				Relationships: []
			}
			users: {
				Row: {
					created_at: string | null
					deleted_at: string | null
					id: string
					name: string
					updated_at: string | null
				}
				Insert: {
					created_at?: string | null
					deleted_at?: string | null
					id: string
					name: string
					updated_at?: string | null
				}
				Update: {
					created_at?: string | null
					deleted_at?: string | null
					id?: string
					name?: string
					updated_at?: string | null
				}
				Relationships: []
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			get_current_user_id: {
				Args: Record<PropertyKey, never>
				Returns: string
			}
			get_user_organisation: {
				Args: { organisation_id: string; user_id: string }
				Returns: string
			}
			has_organisation_role: {
				Args: {
					organisation_id: string
					required_role: string
					user_id: string
				}
				Returns: boolean
			}
			has_project_role: {
				Args: { p_project_id: string; p_role: string }
				Returns: boolean
			}
			has_project_role_mvp2: {
				Args: { project_id: string; required_role: string; user_id: string }
				Returns: boolean
			}
			has_system_role: {
				Args: { required_role: string; user_id: string }
				Returns: boolean
			}
			soft_delete_deployment: {
				Args: { p_id: string }
				Returns: undefined
			}
			soft_delete_device: {
				Args: { p_device_id: string }
				Returns: undefined
			}
			soft_delete_project: {
				Args: { p_id: string }
				Returns: undefined
			}
			soft_remove_project_member: {
				Args: { p_project_id: string; p_user_id: string }
				Returns: undefined
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R
	  }
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
			DefaultSchema["Views"])
	? (DefaultSchema["Tables"] &
			DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
			Row: infer R
	  }
		? R
		: never
	: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I
	  }
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
	? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
			Insert: infer I
	  }
		? I
		: never
	: never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U
	  }
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
	? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
			Update: infer U
	  }
		? U
		: never
	: never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
	? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
	: never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
	? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
	: never

export const Constants = {
	graphql_public: {
		Enums: {},
	},
	public: {
		Enums: {},
	},
} as const
