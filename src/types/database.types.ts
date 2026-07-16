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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          id: string
          notes: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          notes?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          notes?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      activity_sensitivity: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          id: number
          is_active: boolean
          modified_by: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      ai_model_families: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          firmware_model_id: number
          id: string
          name: string
          organisation_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          firmware_model_id?: number
          id?: string
          name: string
          organisation_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          firmware_model_id?: number
          id?: string
          name?: string
          organisation_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "ai_model_families_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["organisation_id"]
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
            referencedRelation: "deployment_overview"
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
          compiled_format: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          detection_capabilities: string[] | null
          error_message: string | null
          file_hash: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          label_map: Json | null
          labels_path: string | null
          model_family_id: string | null
          model_path: string | null
          modified_by: string | null
          name: string
          organisation_id: string
          processing_log: Json | null
          status: Database["public"]["Enums"]["ai_model_status"] | null
          updated_at: string | null
          uploaded_by: string | null
          version: string
          version_number: number
        }
        Insert: {
          compiled_format?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          detection_capabilities?: string[] | null
          error_message?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          label_map?: Json | null
          labels_path?: string | null
          model_family_id?: string | null
          model_path?: string | null
          modified_by?: string | null
          name: string
          organisation_id: string
          processing_log?: Json | null
          status?: Database["public"]["Enums"]["ai_model_status"] | null
          updated_at?: string | null
          uploaded_by?: string | null
          version: string
          version_number: number
        }
        Update: {
          compiled_format?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          detection_capabilities?: string[] | null
          error_message?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          label_map?: Json | null
          labels_path?: string | null
          model_family_id?: string | null
          model_path?: string | null
          modified_by?: string | null
          name?: string
          organisation_id?: string
          processing_log?: Json | null
          status?: Database["public"]["Enums"]["ai_model_status"] | null
          updated_at?: string | null
          uploaded_by?: string | null
          version?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_model_family_id_fkey"
            columns: ["model_family_id"]
            isOneToOne: false
            referencedRelation: "ai_model_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_models_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
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
      annotation_runs: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_by: string | null
          deployment_id: string
          id: string
          model_id: string | null
          observation_count: number | null
          run_type: string
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_by?: string | null
          deployment_id: string
          id?: string
          model_id?: string | null
          observation_count?: number | null
          run_type: string
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_by?: string | null
          deployment_id?: string
          id?: string
          model_id?: string | null
          observation_count?: number | null
          run_type?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "annotation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "annotation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "annotation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "annotation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_runs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "annotation_runs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      api_jobs: {
        Row: {
          created_at: string | null
          id: string
          job_data: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          job_data: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_data?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "deployment_overview"
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
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
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
            foreignKeyName: "api_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
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
          is_active: boolean
          modified_by: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      cluster_assignments: {
        Row: {
          cluster_id: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          deployment_id: string
          embedding_run_id: string
          id: string
          image_count: number
          is_outlier_cluster: boolean
          lock_expires: string | null
          locked_at: string | null
          locked_by: string | null
          mean_confidence: number | null
          purity_score: number | null
          review_depth: string | null
          review_state: string
          scientific_name: string | null
          taxon_id: string | null
          updated_at: string | null
        }
        Insert: {
          cluster_id: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          deployment_id: string
          embedding_run_id: string
          id?: string
          image_count?: number
          is_outlier_cluster?: boolean
          lock_expires?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mean_confidence?: number | null
          purity_score?: number | null
          review_depth?: string | null
          review_state?: string
          scientific_name?: string | null
          taxon_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cluster_id?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          deployment_id?: string
          embedding_run_id?: string
          id?: string
          image_count?: number
          is_outlier_cluster?: boolean
          lock_expires?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mean_confidence?: number | null
          purity_score?: number | null
          review_depth?: string | null
          review_state?: string
          scientific_name?: string | null
          taxon_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cluster_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_assignments_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "cluster_assignments_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_assignments_embedding_run_id_fkey"
            columns: ["embedding_run_id"]
            isOneToOne: false
            referencedRelation: "embedding_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_assignments_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cluster_assignments_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_assignments_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      conservation_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          deployment_id: string | null
          details: Json | null
          first_seen: string | null
          id: string
          project_id: string
          severity: string
          taxon_id: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          deployment_id?: string | null
          details?: Json | null
          first_seen?: string | null
          id?: string
          project_id: string
          severity?: string
          taxon_id?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          deployment_id?: string | null
          details?: Json | null
          first_seen?: string | null
          id?: string
          project_id?: string
          severity?: string
          taxon_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conservation_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conservation_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conservation_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conservation_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conservation_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conservation_alerts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "conservation_alerts_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conservation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conservation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conservation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conservation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conservation_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conservation_alerts_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_storage_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      deployment_effort: {
        Row: {
          battery_failures: number
          camera_uptime_hours: number
          computed_at: string | null
          deployment_id: string
          false_trigger_rate: number
          total_events: number
          total_media: number
          trap_nights: number
        }
        Insert: {
          battery_failures?: number
          camera_uptime_hours?: number
          computed_at?: string | null
          deployment_id: string
          false_trigger_rate?: number
          total_events?: number
          total_media?: number
          trap_nights?: number
        }
        Update: {
          battery_failures?: number
          camera_uptime_hours?: number
          computed_at?: string | null
          deployment_id?: string
          false_trigger_rate?: number
          total_events?: number
          total_media?: number
          trap_nights?: number
        }
        Relationships: [
          {
            foreignKeyName: "deployment_effort_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: true
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "deployment_effort_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: true
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_statuses: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          id: number
          is_active: boolean
          modified_by: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      deployments: {
        Row: {
          accuracy: number | null
          activity_detection_sensitivity_id: number | null
          ai_model_id: string | null
          altitude: number | null
          bait_use: string | null
          battery_level_at_start: number | null
          ble_firmware_id: string | null
          camera_height: number | null
          camera_location_image_paths: Json | null
          camera_model: string | null
          camera_tilt: number | null
          capture_method_id: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_end: string | null
          deployment_photos: Json | null
          deployment_start: string
          deployment_status_id: number | null
          deployment_tags: string[] | null
          detection_distance: number | null
          device_eui: string | null
          device_id: string
          end_deployment_comments: string | null
          ended_by: string | null
          feature_type: string | null
          habitat: string | null
          himax_firmware_id: string | null
          id: string
          latitude: number | null
          location: unknown
          location_data: Json | null
          location_description: string | null
          location_name: string
          longitude: number | null
          lorawan_last_verified_at: string | null
          lorawan_network: string | null
          lorawan_registration_completed: boolean
          lorawan_rssi_at_start: number | null
          lorawan_snr_at_start: number | null
          name: string
          project_id: string
          sd_card_available_kb_at_start: number | null
          sd_card_total_kb_at_start: number | null
          setup_by: string | null
          start_deployment_comments: string | null
          timelapse_interval_seconds: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          accuracy?: number | null
          activity_detection_sensitivity_id?: number | null
          ai_model_id?: string | null
          altitude?: number | null
          bait_use?: string | null
          battery_level_at_start?: number | null
          ble_firmware_id?: string | null
          camera_height?: number | null
          camera_location_image_paths?: Json | null
          camera_model?: string | null
          camera_tilt?: number | null
          capture_method_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_end?: string | null
          deployment_photos?: Json | null
          deployment_start: string
          deployment_status_id?: number | null
          deployment_tags?: string[] | null
          detection_distance?: number | null
          device_eui?: string | null
          device_id: string
          end_deployment_comments?: string | null
          ended_by?: string | null
          feature_type?: string | null
          habitat?: string | null
          himax_firmware_id?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          location_data?: Json | null
          location_description?: string | null
          location_name: string
          longitude?: number | null
          lorawan_last_verified_at?: string | null
          lorawan_network?: string | null
          lorawan_registration_completed?: boolean
          lorawan_rssi_at_start?: number | null
          lorawan_snr_at_start?: number | null
          name: string
          project_id: string
          sd_card_available_kb_at_start?: number | null
          sd_card_total_kb_at_start?: number | null
          setup_by?: string | null
          start_deployment_comments?: string | null
          timelapse_interval_seconds?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          accuracy?: number | null
          activity_detection_sensitivity_id?: number | null
          ai_model_id?: string | null
          altitude?: number | null
          bait_use?: string | null
          battery_level_at_start?: number | null
          ble_firmware_id?: string | null
          camera_height?: number | null
          camera_location_image_paths?: Json | null
          camera_model?: string | null
          camera_tilt?: number | null
          capture_method_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_end?: string | null
          deployment_photos?: Json | null
          deployment_start?: string
          deployment_status_id?: number | null
          deployment_tags?: string[] | null
          detection_distance?: number | null
          device_eui?: string | null
          device_id?: string
          end_deployment_comments?: string | null
          ended_by?: string | null
          feature_type?: string | null
          habitat?: string | null
          himax_firmware_id?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          location_data?: Json | null
          location_description?: string | null
          location_name?: string
          longitude?: number | null
          lorawan_last_verified_at?: string | null
          lorawan_network?: string | null
          lorawan_registration_completed?: boolean
          lorawan_rssi_at_start?: number | null
          lorawan_snr_at_start?: number | null
          name?: string
          project_id?: string
          sd_card_available_kb_at_start?: number | null
          sd_card_total_kb_at_start?: number | null
          setup_by?: string | null
          start_deployment_comments?: string | null
          timelapse_interval_seconds?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_activity_detection_sensitivity_id_fkey"
            columns: ["activity_detection_sensitivity_id"]
            isOneToOne: false
            referencedRelation: "activity_sensitivity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_ai_model_id_fkey"
            columns: ["ai_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_ble_firmware_id_fkey"
            columns: ["ble_firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_capture_method_id_fkey"
            columns: ["capture_method_id"]
            isOneToOne: false
            referencedRelation: "capture_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_deployment_status_id_fkey"
            columns: ["deployment_status_id"]
            isOneToOne: false
            referencedRelation: "deployment_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "deployments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_himax_firmware_id_fkey"
            columns: ["himax_firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      device_alert_rules: {
        Row: {
          backoff_steps_min: number[]
          clear_window_min: number
          created_at: string | null
          created_by: string | null
          digest_send_utc: number | null
          enabled: boolean
          id: string
          label: string
          mode: string
          model_family_id: string
          project_id: string
          threshold_pct: number
          updated_at: string | null
        }
        Insert: {
          backoff_steps_min?: number[]
          clear_window_min?: number
          created_at?: string | null
          created_by?: string | null
          digest_send_utc?: number | null
          enabled?: boolean
          id?: string
          label: string
          mode: string
          model_family_id: string
          project_id: string
          threshold_pct?: number
          updated_at?: string | null
        }
        Update: {
          backoff_steps_min?: number[]
          clear_window_min?: number
          created_at?: string | null
          created_by?: string | null
          digest_send_utc?: number | null
          enabled?: boolean
          id?: string
          label?: string
          mode?: string
          model_family_id?: string
          project_id?: string
          threshold_pct?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_alert_rules_model_family_id_fkey"
            columns: ["model_family_id"]
            isOneToOne: false
            referencedRelation: "ai_model_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "device_alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "device_alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "device_alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_alert_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          bluetooth_id: string
          created_at: string | null
          deleted_at: string | null
          device_eui: string | null
          id: string
          modified_by: string | null
          name: string
          organisation_id: string | null
          updated_at: string | null
        }
        Insert: {
          bluetooth_id: string
          created_at?: string | null
          deleted_at?: string | null
          device_eui?: string | null
          id?: string
          modified_by?: string | null
          name: string
          organisation_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bluetooth_id?: string
          created_at?: string | null
          deleted_at?: string | null
          device_eui?: string | null
          id?: string
          modified_by?: string | null
          name?: string
          organisation_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
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
      ecological_shift_reports: {
        Row: {
          alert_level: string | null
          changed_clusters: Json | null
          computed_at: string | null
          created_at: string | null
          deployment_id: string
          divergence: number | null
          id: string
          method: string | null
          period_a_end: string
          period_a_start: string
          period_b_end: string
          period_b_start: string
        }
        Insert: {
          alert_level?: string | null
          changed_clusters?: Json | null
          computed_at?: string | null
          created_at?: string | null
          deployment_id: string
          divergence?: number | null
          id?: string
          method?: string | null
          period_a_end: string
          period_a_start: string
          period_b_end: string
          period_b_start: string
        }
        Update: {
          alert_level?: string | null
          changed_clusters?: Json | null
          computed_at?: string | null
          created_at?: string | null
          deployment_id?: string
          divergence?: number | null
          id?: string
          method?: string | null
          period_a_end?: string
          period_a_start?: string
          period_b_end?: string
          period_b_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecological_shift_reports_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "ecological_shift_reports_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_runs: {
        Row: {
          clustering_method: string | null
          clustering_params: Json | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deployment_id: string | null
          embedding_dim: number
          execution_provider: string | null
          id: string
          image_count: number
          model_name: string
          model_version: string
          project_id: string | null
          qdrant_collection: string
          reduction_method: string | null
          reduction_params: Json | null
          scope: string
          scope_id: string | null
          status: string
        }
        Insert: {
          clustering_method?: string | null
          clustering_params?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deployment_id?: string | null
          embedding_dim?: number
          execution_provider?: string | null
          id?: string
          image_count?: number
          model_name: string
          model_version: string
          project_id?: string | null
          qdrant_collection?: string
          reduction_method?: string | null
          reduction_params?: Json | null
          scope?: string
          scope_id?: string | null
          status?: string
        }
        Update: {
          clustering_method?: string | null
          clustering_params?: Json | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deployment_id?: string | null
          embedding_dim?: number
          execution_provider?: string | null
          id?: string
          image_count?: number
          model_name?: string
          model_version?: string
          project_id?: string | null
          qdrant_collection?: string
          reduction_method?: string | null
          reduction_params?: Json | null
          scope?: string
          scope_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "embedding_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "embedding_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "embedding_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "embedding_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "embedding_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_runs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "embedding_runs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "embedding_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "embedding_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "embedding_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      firmware: {
        Row: {
          build_date: string | null
          camera_variant: string | null
          crc_checksum: string | null
          created_at: string | null
          deleted_at: string | null
          file_size_bytes: number | null
          id: string
          is_active: boolean
          location_path: string
          modified_by: string | null
          name: string
          release_notes: string | null
          type: string
          updated_at: string | null
          version: string
        }
        Insert: {
          build_date?: string | null
          camera_variant?: string | null
          crc_checksum?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          location_path: string
          modified_by?: string | null
          name: string
          release_notes?: string | null
          type: string
          updated_at?: string | null
          version: string
        }
        Update: {
          build_date?: string | null
          camera_variant?: string | null
          crc_checksum?: string | null
          created_at?: string | null
          deleted_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          location_path?: string
          modified_by?: string | null
          name?: string
          release_notes?: string | null
          type?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      inat_observation_media: {
        Row: {
          created_at: string | null
          id: string
          inat_observation_id: string
          inat_photo_id: number | null
          media_id: string
          original_filename: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inat_observation_id: string
          inat_photo_id?: number | null
          media_id: string
          original_filename?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inat_observation_id?: string
          inat_photo_id?: number | null
          media_id?: string
          original_filename?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inat_observation_media_inat_observation_id_fkey"
            columns: ["inat_observation_id"]
            isOneToOne: false
            referencedRelation: "inat_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inat_observation_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      inat_observations: {
        Row: {
          community_taxon: string | null
          community_taxon_id: string | null
          created_at: string | null
          deployment_id: string
          error_message: string | null
          geoprivacy: string
          id: string
          inat_observation_id: number | null
          inat_uri: string | null
          inat_uuid: string | null
          last_synced_at: string | null
          observation_event_id: string | null
          quality_grade: string | null
          species_guess: string | null
          sync_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          community_taxon?: string | null
          community_taxon_id?: string | null
          created_at?: string | null
          deployment_id: string
          error_message?: string | null
          geoprivacy?: string
          id?: string
          inat_observation_id?: number | null
          inat_uri?: string | null
          inat_uuid?: string | null
          last_synced_at?: string | null
          observation_event_id?: string | null
          quality_grade?: string | null
          species_guess?: string | null
          sync_status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          community_taxon?: string | null
          community_taxon_id?: string | null
          created_at?: string | null
          deployment_id?: string
          error_message?: string | null
          geoprivacy?: string
          id?: string
          inat_observation_id?: number | null
          inat_uri?: string | null
          inat_uuid?: string | null
          last_synced_at?: string | null
          observation_event_id?: string | null
          quality_grade?: string | null
          species_guess?: string | null
          sync_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inat_observations_community_taxon_id_fkey"
            columns: ["community_taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inat_observations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "inat_observations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inat_observations_observation_event_id_fkey"
            columns: ["observation_event_id"]
            isOneToOne: false
            referencedRelation: "observation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inat_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inat_tokens: {
        Row: {
          created_at: string | null
          encrypted_token: string
          id: string
          inat_username: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_token: string
          id?: string
          inat_username?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_token?: string
          id?: string
          inat_username?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inat_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inat_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
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
            referencedRelation: "deployment_overview"
            referencedColumns: ["device_id"]
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
            referencedRelation: "deployment_overview"
            referencedColumns: ["device_id"]
          },
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
      media: {
        Row: {
          capture_method_id: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_id: string
          exif_metadata: Json | null
          favorite: boolean
          file_hash: string | null
          file_mediatype: string
          file_name: string | null
          file_path: string
          file_public: boolean
          id: string
          media_comments: string | null
          timestamp: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          capture_method_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_id: string
          exif_metadata?: Json | null
          favorite?: boolean
          file_hash?: string | null
          file_mediatype?: string
          file_name?: string | null
          file_path: string
          file_public?: boolean
          id?: string
          media_comments?: string | null
          timestamp?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          capture_method_id?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_id?: string
          exif_metadata?: Json | null
          favorite?: boolean
          file_hash?: string | null
          file_mediatype?: string
          file_name?: string | null
          file_path?: string
          file_public?: boolean
          id?: string
          media_comments?: string | null
          timestamp?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_capture_method_id_fkey"
            columns: ["capture_method_id"]
            isOneToOne: false
            referencedRelation: "capture_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "media_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          animal_crop_url: string | null
          created_at: string | null
          file_size_bytes: number | null
          media_id: string
          original_height: number | null
          original_width: number | null
          preview_url: string | null
          storage_key: string | null
          storage_provider: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          animal_crop_url?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          media_id: string
          original_height?: number | null
          original_width?: number | null
          preview_url?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          animal_crop_url?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          media_id?: string
          original_height?: number | null
          original_width?: number | null
          preview_url?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_embeddings: {
        Row: {
          active_learning_score: number | null
          al_score_updated_at: string | null
          cluster_confidence: number | null
          cluster_id: number | null
          cluster_purity: string | null
          created_at: string | null
          deployment_id: string
          embedding: string | null
          embedding_model: string | null
          embedding_run_id: string | null
          is_outlier: boolean
          media_id: string
          qdrant_point_id: string | null
          umap_x: number | null
          umap_y: number | null
          updated_at: string | null
        }
        Insert: {
          active_learning_score?: number | null
          al_score_updated_at?: string | null
          cluster_confidence?: number | null
          cluster_id?: number | null
          cluster_purity?: string | null
          created_at?: string | null
          deployment_id: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_run_id?: string | null
          is_outlier?: boolean
          media_id: string
          qdrant_point_id?: string | null
          umap_x?: number | null
          umap_y?: number | null
          updated_at?: string | null
        }
        Update: {
          active_learning_score?: number | null
          al_score_updated_at?: string | null
          cluster_confidence?: number | null
          cluster_id?: number | null
          cluster_purity?: string | null
          created_at?: string | null
          deployment_id?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_run_id?: string | null
          is_outlier?: boolean
          media_id?: string
          qdrant_point_id?: string | null
          umap_x?: number | null
          umap_y?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_media_embeddings_media"
            columns: ["media_id", "deployment_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id", "deployment_id"]
          },
          {
            foreignKeyName: "media_embeddings_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "media_embeddings_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_embeddings_embedding_run_id_fkey"
            columns: ["embedding_run_id"]
            isOneToOne: false
            referencedRelation: "embedding_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          channels: string[]
          created_at: string | null
          digest: string
          event_type: string
          id: string
          is_active: boolean
          project_id: string
          species_filter: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string | null
          digest?: string
          event_type: string
          id?: string
          is_active?: boolean
          project_id: string
          species_filter?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string | null
          digest?: string
          event_type?: string
          id?: string
          is_active?: boolean
          project_id?: string
          species_filter?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          deployment_id: string | null
          id: string
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          deployment_id?: string | null
          id?: string
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          deployment_id?: string | null
          id?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "notifications_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      observation_events: {
        Row: {
          confidence: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deployment_id: string
          empty_event_score: number | null
          end_time: string
          event_duration_seconds: number
          id: string
          media_count: number
          primary_media_id: string | null
          review_status: string
          start_time: string
          taxon_id: string | null
          trigger_type: string | null
          updated_at: string | null
          validated_by: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deployment_id: string
          empty_event_score?: number | null
          end_time: string
          event_duration_seconds: number
          id?: string
          media_count?: number
          primary_media_id?: string | null
          review_status?: string
          start_time: string
          taxon_id?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deployment_id?: string
          empty_event_score?: number | null
          end_time?: string
          event_duration_seconds?: number
          id?: string
          media_count?: number
          primary_media_id?: string | null
          review_status?: string
          start_time?: string
          taxon_id?: string | null
          trigger_type?: string | null
          updated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_observation_events_primary_media"
            columns: ["primary_media_id", "deployment_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id", "deployment_id"]
          },
          {
            foreignKeyName: "observation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "observation_events_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observation_events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          ai_origin: string | null
          annotator_id: string | null
          bbox_h: number | null
          bbox_w: number | null
          bbox_x: number | null
          bbox_y: number | null
          behavior: string | null
          classification_method: string | null
          classification_probability: number | null
          classification_timestamp: string | null
          classified_by: string | null
          classifier_category: string | null
          cluster_id: number | null
          confidence: number | null
          count: number | null
          created_at: string | null
          crop_url: string | null
          deleted_at: string | null
          deployment_id: string
          embedding_run_id: string | null
          id: string
          individual_id: string | null
          life_stage: string | null
          media_id: string | null
          observation_comments: string | null
          observation_event_id: string | null
          observation_level: string | null
          observation_tags: string[] | null
          observation_type: string | null
          review_status: string
          reviewer_id: string | null
          scientific_name: string | null
          sex: string | null
          source_model_id: string | null
          source_model_version: string | null
          source_type: string | null
          taxon_id: string | null
          updated_at: string | null
          vernacular_name: string | null
        }
        Insert: {
          ai_origin?: string | null
          annotator_id?: string | null
          bbox_h?: number | null
          bbox_w?: number | null
          bbox_x?: number | null
          bbox_y?: number | null
          behavior?: string | null
          classification_method?: string | null
          classification_probability?: number | null
          classification_timestamp?: string | null
          classified_by?: string | null
          classifier_category?: string | null
          cluster_id?: number | null
          confidence?: number | null
          count?: number | null
          created_at?: string | null
          crop_url?: string | null
          deleted_at?: string | null
          deployment_id: string
          embedding_run_id?: string | null
          id?: string
          individual_id?: string | null
          life_stage?: string | null
          media_id?: string | null
          observation_comments?: string | null
          observation_event_id?: string | null
          observation_level?: string | null
          observation_tags?: string[] | null
          observation_type?: string | null
          review_status?: string
          reviewer_id?: string | null
          scientific_name?: string | null
          sex?: string | null
          source_model_id?: string | null
          source_model_version?: string | null
          source_type?: string | null
          taxon_id?: string | null
          updated_at?: string | null
          vernacular_name?: string | null
        }
        Update: {
          ai_origin?: string | null
          annotator_id?: string | null
          bbox_h?: number | null
          bbox_w?: number | null
          bbox_x?: number | null
          bbox_y?: number | null
          behavior?: string | null
          classification_method?: string | null
          classification_probability?: number | null
          classification_timestamp?: string | null
          classified_by?: string | null
          classifier_category?: string | null
          cluster_id?: number | null
          confidence?: number | null
          count?: number | null
          created_at?: string | null
          crop_url?: string | null
          deleted_at?: string | null
          deployment_id?: string
          embedding_run_id?: string | null
          id?: string
          individual_id?: string | null
          life_stage?: string | null
          media_id?: string | null
          observation_comments?: string | null
          observation_event_id?: string | null
          observation_level?: string | null
          observation_tags?: string[] | null
          observation_type?: string | null
          review_status?: string
          reviewer_id?: string | null
          scientific_name?: string | null
          sex?: string | null
          source_model_id?: string | null
          source_model_version?: string | null
          source_type?: string | null
          taxon_id?: string | null
          updated_at?: string | null
          vernacular_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_observations_event"
            columns: ["observation_event_id", "deployment_id"]
            isOneToOne: false
            referencedRelation: "observation_events"
            referencedColumns: ["id", "deployment_id"]
          },
          {
            foreignKeyName: "fk_observations_media"
            columns: ["media_id", "deployment_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id", "deployment_id"]
          },
          {
            foreignKeyName: "observations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_annotator_id_fkey"
            columns: ["annotator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["deployment_id"]
          },
          {
            foreignKeyName: "observations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_embedding_run_id_fkey"
            columns: ["embedding_run_id"]
            isOneToOne: false
            referencedRelation: "embedding_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "organisation_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_access_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_roles_detailed"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "observations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_source_model_id_fkey"
            columns: ["source_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          modified_by: string | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          modified_by?: string | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          modified_by?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          invitee_id: string | null
          inviter_id: string
          project_id: string
          responded_at: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email: string
          invitee_id?: string | null
          inviter_id: string
          project_id: string
          responded_at?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          invitee_id?: string | null
          inviter_id?: string
          project_id?: string
          responded_at?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "deployment_overview"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_members_detailed"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_with_stats"
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
          is_archived: boolean
          is_baited: boolean | null
          is_monitoring_marked_individuals: boolean | null
          lorawan_required: boolean
          model_id: string | null
          modified_by: string | null
          name: string
          organisation_id: string
          project_image: string | null
          record_gps_in_images: boolean
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
          is_archived?: boolean
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          lorawan_required?: boolean
          model_id?: string | null
          modified_by?: string | null
          name: string
          organisation_id: string
          project_image?: string | null
          record_gps_in_images?: boolean
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
          is_archived?: boolean
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          lorawan_required?: boolean
          model_id?: string | null
          modified_by?: string | null
          name?: string
          organisation_id?: string
          project_image?: string | null
          record_gps_in_images?: boolean
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
            referencedRelation: "deployment_overview"
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
      sampling_designs: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          id: number
          is_active: boolean
          modified_by: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          id?: number
          is_active?: boolean
          modified_by?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      species_event_config: {
        Row: {
          created_at: string | null
          gap_minutes: number
          id: string
          min_images: number
          notes: string | null
          taxon_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gap_minutes?: number
          id?: string
          min_images?: number
          notes?: string | null
          taxon_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gap_minutes?: number
          id?: string
          min_images?: number
          notes?: string | null
          taxon_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "species_event_config_taxon_id_fkey"
            columns: ["taxon_id"]
            isOneToOne: true
            referencedRelation: "taxa"
            referencedColumns: ["id"]
          },
        ]
      }
      taxa: {
        Row: {
          class: string | null
          common_name: string | null
          conservation_status: string | null
          created_at: string | null
          family: string | null
          gbif_taxon_id: string | null
          genus: string | null
          id: string
          inat_taxon_id: string | null
          invasive_status: boolean | null
          kingdom: string | null
          nzor_id: string | null
          order_name: string | null
          phylum: string | null
          rank: string
          scientific_name: string
          species: string | null
          status: string
        }
        Insert: {
          class?: string | null
          common_name?: string | null
          conservation_status?: string | null
          created_at?: string | null
          family?: string | null
          gbif_taxon_id?: string | null
          genus?: string | null
          id?: string
          inat_taxon_id?: string | null
          invasive_status?: boolean | null
          kingdom?: string | null
          nzor_id?: string | null
          order_name?: string | null
          phylum?: string | null
          rank: string
          scientific_name: string
          species?: string | null
          status?: string
        }
        Update: {
          class?: string | null
          common_name?: string | null
          conservation_status?: string | null
          created_at?: string | null
          family?: string | null
          gbif_taxon_id?: string | null
          genus?: string | null
          id?: string
          inat_taxon_id?: string | null
          invasive_status?: boolean | null
          kingdom?: string | null
          nzor_id?: string | null
          order_name?: string | null
          phylum?: string | null
          rank?: string
          scientific_name?: string
          species?: string | null
          status?: string
        }
        Relationships: []
      }
      upload_quotas: {
        Row: {
          created_at: string | null
          max_compute_seconds: number | null
          max_photos: number | null
          max_storage_bytes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          max_compute_seconds?: number | null
          max_photos?: number | null
          max_storage_bytes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          max_compute_seconds?: number | null
          max_photos?: number | null
          max_storage_bytes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          modified_by: string | null
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
          modified_by?: string | null
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
          modified_by?: string | null
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
          email: string | null
          firstname: string
          id: string
          modified_by: string | null
          surname: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          firstname: string
          id: string
          modified_by?: string | null
          surname: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          firstname?: string
          id?: string
          modified_by?: string | null
          surname?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      deployment_overview: {
        Row: {
          accuracy: number | null
          altitude: number | null
          ble_firmware_id: string | null
          bluetooth_id: string | null
          camera_height: number | null
          camera_location_image_paths: Json | null
          created_at: string | null
          created_by_email: string | null
          created_by_name: string | null
          deleted_at: string | null
          deployment_end: string | null
          deployment_id: string | null
          deployment_name: string | null
          deployment_start: string | null
          deployment_status: string | null
          device_id: string | null
          device_name: string | null
          end_deployment_comments: string | null
          geolocation: unknown
          himax_firmware_id: string | null
          latitude: number | null
          location_description: string | null
          location_name: string | null
          longitude: number | null
          organisation_id: string | null
          organisation_name: string | null
          project_id: string | null
          project_name: string | null
          start_deployment_comments: string | null
          status_description: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_ble_firmware_id_fkey"
            columns: ["ble_firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_himax_firmware_id_fkey"
            columns: ["himax_firmware_id"]
            isOneToOne: false
            referencedRelation: "firmware"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      my_model_upload_permissions: {
        Row: {
          role: string | null
          scope_id_text: string | null
          scope_type: string | null
        }
        Insert: {
          role?: string | null
          scope_id_text?: never
          scope_type?: string | null
        }
        Update: {
          role?: string | null
          scope_id_text?: never
          scope_type?: string | null
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
          name: string | null
          org_project_admin_count: number | null
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
      projects_with_stats: {
        Row: {
          activity_detection_sensitivity_id: number | null
          battery_level: number | null
          capture_method_id: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deployment_count: number | null
          description: string | null
          id: string | null
          is_active: boolean | null
          is_archived: boolean | null
          is_baited: boolean | null
          is_monitoring_marked_individuals: boolean | null
          lorawan_device_count: number | null
          lorawan_required: boolean | null
          member_count: number | null
          model_id: string | null
          modified_by: string | null
          name: string | null
          organisation_id: string | null
          project_image: string | null
          record_gps_in_images: boolean | null
          sampling_design_id: number | null
          sd_card_usage: number | null
          timelapse_interval_seconds: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          activity_detection_sensitivity_id?: number | null
          battery_level?: never
          capture_method_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deployment_count?: never
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          lorawan_device_count?: never
          lorawan_required?: boolean | null
          member_count?: never
          model_id?: string | null
          modified_by?: string | null
          name?: string | null
          organisation_id?: string | null
          project_image?: string | null
          record_gps_in_images?: boolean | null
          sampling_design_id?: number | null
          sd_card_usage?: never
          timelapse_interval_seconds?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          activity_detection_sensitivity_id?: number | null
          battery_level?: never
          capture_method_id?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deployment_count?: never
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_baited?: boolean | null
          is_monitoring_marked_individuals?: boolean | null
          lorawan_device_count?: never
          lorawan_required?: boolean | null
          member_count?: never
          model_id?: string | null
          modified_by?: string | null
          name?: string | null
          organisation_id?: string | null
          project_image?: string | null
          record_gps_in_images?: boolean | null
          sampling_design_id?: number | null
          sd_card_usage?: never
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
            referencedRelation: "deployment_overview"
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
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      add_project_member: {
        Args: {
          p_granted_by: string
          p_project_id: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_user_usage: {
        Args: never
        Returns: {
          compute_runs: number
          compute_seconds: number
          email: string
          full_name: string
          last_active: string
          last_upload: string
          max_compute_seconds: number
          max_photos: number
          max_storage_bytes: number
          over_quota: boolean
          photos_uploaded: number
          storage_bytes: number
          user_id: string
        }[]
      }
      check_user_uploader_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      debug_get_policies: { Args: never; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_old_invitations: { Args: never; Returns: number }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_current_user_id: { Args: never; Returns: string }
      get_my_pending_invitations: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          inviter_email: string
          inviter_id: string
          inviter_name: string
          project_id: string
          project_name: string
          role: string
        }[]
      }
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
        Args: { p_organisation_id: string }
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
        Args: { p_project_id: string }
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
      get_project_pending_invitations: {
        Args: { p_project_id: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          inviter_id: string
          project_id: string
          role: string
          status: string
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
      gettransactionid: { Args: never; Returns: unknown }
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
      longtransactionsenabled: { Args: never; Returns: boolean }
      match_media_embeddings: {
        Args: {
          match_count?: number
          p_deployment_ids?: string[]
          p_exclude_media_id?: string
          p_model: string
          query_embedding: string
        }
        Returns: {
          cluster_id: number
          deployment_id: string
          distance: number
          media_id: string
        }[]
      }
      my_upload_usage: {
        Args: never
        Returns: {
          compute_seconds: number
          max_compute_seconds: number
          max_photos: number
          max_storage_bytes: number
          over_quota: boolean
          photos_uploaded: number
          storage_bytes: number
        }[]
      }
      next_version_number: { Args: { p_family_id: string }; Returns: number }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      pull_changes: { Args: { last_pulled_at: number }; Returns: Json }
      push_changes: { Args: { changes: Json }; Returns: Json }
      remove_project_member: {
        Args: { p_project_id: string; p_removed_by: string; p_user_id: string }
        Returns: Json
      }
      respond_to_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: undefined
      }
      safe_to_double: { Args: { p_text: string }; Returns: number }
      safe_to_numeric: { Args: { p_text: string }; Returns: number }
      send_project_invitation: {
        Args: { p_invitee_email: string; p_project_id: string; p_role?: string }
        Returns: string
      }
      soft_delete_deployment: { Args: { p_id: string }; Returns: undefined }
      soft_delete_device: { Args: { p_device_id: string }; Returns: undefined }
      soft_delete_project: { Args: { p_id: string }; Returns: undefined }
      soft_remove_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      storage_can_access_deployment_photo: {
        Args: { bucket_id: string; object_name: string; required_role?: string }
        Returns: boolean
      }
      storage_can_upload_model: {
        Args: { bucket_id: string; object_name: string }
        Returns: boolean
      }
      to_timestamp_ms: { Args: { epoch_ms: number }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_project_member_role: {
        Args: {
          p_new_role: string
          p_project_id: string
          p_updated_by: string
          p_user_id: string
        }
        Returns: Json
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      ai_model_status:
        | "draft"
        | "uploading"
        | "uploaded"
        | "validated"
        | "failed"
        | "deployed"
        | "deprecated"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
    Enums: {
      ai_model_status: [
        "draft",
        "uploading",
        "uploaded",
        "validated",
        "failed",
        "deployed",
        "deprecated",
      ],
    },
  },
} as const
