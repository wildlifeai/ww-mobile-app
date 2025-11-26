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
  public: {
    Tables: {
      activity_sensitivity: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          id: number
          is_active: boolean
          modified_by: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_project_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_project_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_project_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["admin_user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["admin_user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_organisation: {
        Row: {
          model_id: string
          organisation_id: string
        }
        Insert: {
          model_id: string
          organisation_id: string
        }
        Update: {
          model_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_organisation_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_organisation_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      ai_models: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          detection_capabilities: string[] | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          modified_by: string
          name: string
          organisation_id: string
          storage_path: string
          updated_at: string | null
          uploaded_by: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          detection_capabilities?: string[] | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          modified_by: string
          name: string
          organisation_id: string
          storage_path: string
          updated_at?: string | null
          uploaded_by?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          detection_capabilities?: string[] | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          modified_by?: string
          name?: string
          organisation_id?: string
          storage_path?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      api_logs: {
        Row: {
          api_endpoint: string | null
          app_version: string | null
          context: Json | null
          correlation_id: string | null
          created_at: string | null
          deleted_at: string | null
          deployment_id: string | null
          device_id: string | null
          id: number
          log_category: string | null
          log_level_id: number | null
          log_message: string | null
          organisation_id: string
          platform: string | null
          project_id: string | null
          session_id: string | null
          source: string | null
          stack_trace: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_endpoint?: string | null
          app_version?: string | null
          context?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_id?: string | null
          device_id?: string | null
          id?: number
          log_category?: string | null
          log_level_id?: number | null
          log_message?: string | null
          organisation_id: string
          platform?: string | null
          project_id?: string | null
          session_id?: string | null
          source?: string | null
          stack_trace?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_endpoint?: string | null
          app_version?: string | null
          context?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_id?: string | null
          device_id?: string | null
          id?: number
          log_category?: string | null
          log_level_id?: number | null
          log_message?: string | null
          organisation_id?: string
          platform?: string | null
          project_id?: string | null
          session_id?: string | null
          source?: string | null
          stack_trace?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "api_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "api_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "api_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "api_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "api_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "fk_api_logs_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_api_logs_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
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
          location: unknown
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
          location?: unknown
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
          location?: unknown
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
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "fk_deployments_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_deployments_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
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
      device_preparation: {
        Row: {
          ai_model_id: string | null
          battery_check_passed: boolean
          camera_view_test_passed: boolean
          created_at: string | null
          deleted_at: string | null
          device_eui: string | null
          device_id: string
          firmware_check_passed: boolean
          firmware_id: string | null
          firmware_updated: boolean
          id: string
          is_deployment_ready: boolean
          lorawan_network: string | null
          lorawan_registration_completed: boolean
          modified_by: string
          project_id: string
          sd_card_check_passed: boolean
          status: string
          updated_at: string | null
        }
        Insert: {
          ai_model_id?: string | null
          battery_check_passed?: boolean
          camera_view_test_passed?: boolean
          created_at?: string | null
          deleted_at?: string | null
          device_eui?: string | null
          device_id: string
          firmware_check_passed?: boolean
          firmware_id?: string | null
          firmware_updated?: boolean
          id?: string
          is_deployment_ready?: boolean
          lorawan_network?: string | null
          lorawan_registration_completed?: boolean
          modified_by: string
          project_id: string
          sd_card_check_passed?: boolean
          status: string
          updated_at?: string | null
        }
        Update: {
          ai_model_id?: string | null
          battery_check_passed?: boolean
          camera_view_test_passed?: boolean
          created_at?: string | null
          deleted_at?: string | null
          device_eui?: string | null
          device_id?: string
          firmware_check_passed?: boolean
          firmware_id?: string | null
          firmware_updated?: boolean
          id?: string
          is_deployment_ready?: boolean
          lorawan_network?: string | null
          lorawan_registration_completed?: boolean
          modified_by?: string
          project_id?: string
          sd_card_check_passed?: boolean
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_preparation_ai_model_id_fkey"
            columns: ["ai_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_preparation_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_preparation_firmware_id_fkey"
            columns: ["firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_preparation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "device_preparation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "device_preparation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "device_preparation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          battery_level: number | null
          bluetooth_id: string
          created_at: string | null
          deleted_at: string | null
          firmware_id: string | null
          firmware_last_updated: string | null
          id: string
          last_battery_check: string | null
          last_sd_card_check: string | null
          modified_by: string
          name: string
          organisation_id: string | null
          sd_card_capacity_total: number | null
          sd_card_capacity_used: number | null
          updated_at: string | null
        }
        Insert: {
          battery_level?: number | null
          bluetooth_id: string
          created_at?: string | null
          deleted_at?: string | null
          firmware_id?: string | null
          firmware_last_updated?: string | null
          id?: string
          last_battery_check?: string | null
          last_sd_card_check?: string | null
          modified_by: string
          name: string
          organisation_id?: string | null
          sd_card_capacity_total?: number | null
          sd_card_capacity_used?: number | null
          updated_at?: string | null
        }
        Update: {
          battery_level?: number | null
          bluetooth_id?: string
          created_at?: string | null
          deleted_at?: string | null
          firmware_id?: string | null
          firmware_last_updated?: string | null
          id?: string
          last_battery_check?: string | null
          last_sd_card_check?: string | null
          modified_by?: string
          name?: string
          organisation_id?: string | null
          sd_card_capacity_total?: number | null
          sd_card_capacity_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_firmware_id_fkey"
            columns: ["firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      firmware: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          location_path: string
          modified_by: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location_path: string
          modified_by: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location_path?: string
          modified_by?: string
          name?: string
          updated_at?: string | null
          version?: string
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
      lorawan_messages: {
        Row: {
          deployment_id: string | null
          device_eui: string
          device_id: string | null
          id: string
          processed_at: string | null
          raw_payload: Json
          received_at: string | null
        }
        Insert: {
          deployment_id?: string | null
          device_eui: string
          device_id?: string | null
          id?: string
          processed_at?: string | null
          raw_payload: Json
          received_at?: string | null
        }
        Update: {
          deployment_id?: string | null
          device_eui?: string
          device_id?: string | null
          id?: string
          processed_at?: string | null
          raw_payload?: Json
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lorawan_messages_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lorawan_messages_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      lorawan_parsed_messages: {
        Row: {
          battery_level: number | null
          device_id: string | null
          id: string
          lorawan_message_id: string
          model_output: string | null
          sd_card_used_capacity: number | null
        }
        Insert: {
          battery_level?: number | null
          device_id?: string | null
          id?: string
          lorawan_message_id: string
          model_output?: string | null
          sd_card_used_capacity?: number | null
        }
        Update: {
          battery_level?: number | null
          device_id?: string | null
          id?: string
          lorawan_message_id?: string
          model_output?: string | null
          sd_card_used_capacity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lorawan_parsed_messages_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lorawan_parsed_messages_lorawan_message_id_fkey"
            columns: ["lorawan_message_id"]
            isOneToOne: false
            referencedRelation: "lorawan_messages"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "fk_project_members_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fk_project_members_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "admin_activity_log"
            referencedColumns: ["target_project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
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
          activity_detection_sensitivity_id: number | null
          capture_method_id: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_baited: boolean | null
          is_monitoring_marked_individuals: boolean | null
          model_id: string | null
          modified_by: string
          name: string
          organisation_id: string
          project_image: string | null
          sampling_design_id: number | null
          timelapse_interval_seconds: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          activity_detection_sensitivity_id?: number | null
          capture_method_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          model_id?: string | null
          modified_by: string
          name: string
          organisation_id: string
          project_image?: string | null
          sampling_design_id?: number | null
          timelapse_interval_seconds?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          activity_detection_sensitivity_id?: number | null
          capture_method_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          model_id?: string | null
          modified_by?: string
          name?: string
          organisation_id?: string
          project_image?: string | null
          sampling_design_id?: number | null
          timelapse_interval_seconds?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_activity_detection_sensitivity_id_fkey"
            columns: ["activity_detection_sensitivity_id"]
            isOneToOne: false
            referencedRelation: "activity_sensitivity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_capture_method_id_fkey"
            columns: ["capture_method_id"]
            isOneToOne: false
            referencedRelation: "capture_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "projects_sampling_design_id_fkey"
            columns: ["sampling_design_id"]
            isOneToOne: false
            referencedRelation: "sampling_designs"
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
      sampling_designs: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          id: number
          is_active: boolean
          modified_by: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string
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
            referencedRelation: "admin_activity_log"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "user_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "user_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "user_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
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
          firstname: string
          id: string
          modified_by: string
          surname: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          firstname: string
          id: string
          modified_by: string
          surname: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          firstname?: string
          id?: string
          modified_by?: string
          surname?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_activity_log: {
        Row: {
          action: string | null
          action_timestamp: string | null
          admin_email: string | null
          admin_name: string | null
          admin_user_id: string | null
          log_id: string | null
          metadata: Json | null
          metadata_org_id: string | null
          organisation_id: string | null
          organisation_name: string | null
          role_affected: string | null
          target_project_id: string | null
          target_project_name: string | null
          target_user_email: string | null
          target_user_id: string | null
          target_user_name: string | null
        }
        Relationships: []
      }
      organisation_members_detailed: {
        Row: {
          is_ww_admin: boolean | null
          member_since: string | null
          membership_updated: string | null
          organisation_id: string | null
          organisation_name: string | null
          organisation_roles: string[] | null
          organisation_slug: string | null
          project_count: number | null
          project_roles: string[] | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      organisation_summary: {
        Row: {
          active_deployment_count: number | null
          active_device_count: number | null
          active_member_count: number | null
          active_project_count: number | null
          created_at: string | null
          created_by_email: string | null
          created_by_name: string | null
          deleted_at: string | null
          id: string | null
          is_active: boolean | null
          last_deployment_created: string | null
          last_project_created: string | null
          metadata: Json | null
          name: string | null
          org_project_admin_count: number | null
          organisation_manager_count: number | null
          slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      project_members_detailed: {
        Row: {
          granted_by_email: string | null
          granted_by_name: string | null
          is_ww_admin: boolean | null
          organisation_id: string | null
          organisation_name: string | null
          organisation_roles: string[] | null
          organisation_slug: string | null
          project_id: string | null
          project_name: string | null
          project_role: string | null
          role_granted_at: string | null
          role_is_active: boolean | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      project_summary: {
        Row: {
          active_deployment_count: number | null
          admin_count: number | null
          api_log_count: number | null
          created_at: string | null
          created_by_email: string | null
          created_by_name: string | null
          deleted_at: string | null
          deployment_count: number | null
          description: string | null
          device_count: number | null
          last_api_activity: string | null
          last_deployment_created: string | null
          last_deployment_updated: string | null
          member_count: number | null
          organisation_id: string | null
          organisation_name: string | null
          organisation_slug: string | null
          project_id: string | null
          project_name: string | null
          total_members: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      recent_activity_summary: {
        Row: {
          activity_timestamp: string | null
          activity_type: string | null
          details: Json | null
          entity_name: string | null
          entity_type: string | null
          organisation_name: string | null
          project_name: string | null
        }
        Relationships: []
      }
      user_access_summary: {
        Row: {
          highest_privilege: string | null
          last_org_joined: string | null
          last_role_granted: string | null
          organisation_count: number | null
          organisation_role_count: number | null
          organisations: string[] | null
          project_count: number | null
          project_role_count: number | null
          system_role: string | null
          user_created_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      user_roles_detailed: {
        Row: {
          deleted_at: string | null
          expires_at: string | null
          granted_at: string | null
          granted_by_email: string | null
          granted_by_name: string | null
          is_active: boolean | null
          organisation_slug: string | null
          role: string | null
          role_id: string | null
          scope_id: string | null
          scope_name: string | null
          scope_type: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_project_member: {
        Args: {
          p_granted_by: string
          p_project_id: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      get_current_user_id: { Args: never; Returns: string }
      get_organisation_report: {
        Args: {
          p_include_inactive?: boolean
          p_organisation_id?: string
          p_organisation_slug?: string
        }
        Returns: {
          created_at: string
          deployment_count: number
          device_count: number
          is_active: boolean
          member_count: number
          members: Json
          organisation_id: string
          organisation_name: string
          organisation_slug: string
          project_count: number
          projects: Json
        }[]
      }
      get_organisation_users: {
        Args: { p_organisation_id: string; p_requesting_user_id?: string }
        Returns: {
          email: string
          id: string
          is_in_project: boolean
          name: string
          roles: Json
        }[]
      }
      get_project_health_report: {
        Args: { p_organisation_id?: string }
        Returns: {
          active_deployment_count: number
          deployment_count: number
          has_admin: boolean
          health_score: number
          issues: Json
          last_activity: string
          member_count: number
          organisation_name: string
          project_id: string
          project_name: string
        }[]
      }
      get_project_members: {
        Args: { p_project_id: string; p_requesting_user_id?: string }
        Returns: {
          email: string
          granted_at: string
          granted_by: string
          granted_by_name: string
          id: string
          name: string
          role: string
        }[]
      }
      get_user_access_report: {
        Args: { p_user_email?: string; p_user_id?: string }
        Returns: {
          organisations: Json
          projects: Json
          system_role: string
          total_permissions: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_user_organisation: {
        Args: { organisation_id?: string; user_id?: string }
        Returns: string
      }
      has_organisation_role: {
        Args: {
          organisation_id?: string
          required_role?: string
          user_id?: string
        }
        Returns: boolean
      }
      has_project_role: {
        Args: { project_id?: string; required_role?: string; user_id?: string }
        Returns: boolean
      }
      has_system_role: {
        Args: { required_role?: string; user_id?: string }
        Returns: boolean
      }
      pull_changes: { Args: { last_pulled_at: number }; Returns: Json }
      push_changes: { Args: { changes: Json }; Returns: undefined }
      remove_project_member: {
        Args: { p_project_id: string; p_removed_by: string; p_user_id: string }
        Returns: Json
      }
      soft_delete_deployment: { Args: { p_id: string }; Returns: undefined }
      soft_delete_device: { Args: { p_device_id: string }; Returns: undefined }
      soft_delete_project: { Args: { p_id: string }; Returns: undefined }
      soft_remove_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: undefined
      }
      to_timestamp_ms: { Args: { epoch_ms: number }; Returns: string }
      update_project_member_role: {
        Args: {
          p_new_role: string
          p_project_id: string
          p_updated_by: string
          p_user_id: string
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
  public: {
    Enums: {},
  },
} as const
