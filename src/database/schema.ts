/**
 * ⚠️ WARNING: DO NOT MANUALLY EDIT THIS FILE ⚠️
 * 
 * This schema MUST stay in sync with the Supabase database schema.
 * Manual modifications will cause runtime errors and data inconsistencies.
 * 
 * TO UPDATE THIS SCHEMA:
 * 1. Make changes in Supabase (backend migrations)
 * 2. Regenerate types: `npm run types:cloud-dev`
 * 3. Validate schema: `npm run schema:validate:live:cloud-dev`
 * 4. Update this file based on validation errors (if any)
 * 
 * See: scripts/README-SCHEMA-VALIDATION.md for detailed workflow
 * See: scripts/README-TYPE-SCRIPTS.md for type synchronization
 * 
 * Schema Version History:
 * - v6: Migrated from project_members to user_roles, added modified_by to all tables
 * - v5: Added project reference fields (sampling_design_id, capture_method_id, etc.)
 * - v4: Added device_preparation table
 * - v3: Initial MVP2 schema
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
    version: 8,
    tables: [
        tableSchema({
            name: 'projects',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'organisation_id', type: 'string' },
                { name: 'is_active', type: 'boolean' },
                { name: 'is_baited', type: 'boolean', isOptional: true },
                { name: 'is_monitoring_marked_individuals', type: 'boolean', isOptional: true },
                { name: 'timelapse_interval_seconds', type: 'number', isOptional: true },
                { name: 'project_image', type: 'string', isOptional: true },
                { name: 'website', type: 'string', isOptional: true },
                // Reference IDs
                { name: 'sampling_design_id', type: 'number', isOptional: true },
                { name: 'activity_detection_sensitivity_id', type: 'number', isOptional: true },
                { name: 'capture_method_id', type: 'number', isOptional: true },
                { name: 'model_id', type: 'string', isOptional: true },
                // Audit fields
                { name: 'created_by', type: 'string' },
                { name: 'modified_by', type: 'string' },
                // Timestamps
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'deployments',
            columns: [
                { name: 'project_id', type: 'string', isIndexed: true },
                { name: 'user_id', type: 'string', isIndexed: true },
                { name: 'device_id', type: 'string' },
                { name: 'deployment_status_id', type: 'number', isOptional: true },
                { name: 'capture_method_id', type: 'number', isOptional: true },
                { name: 'name', type: 'string', isOptional: true },
                { name: 'location_name', type: 'string' },
                { name: 'location', type: 'string' }, // JSON stored as string
                { name: 'latitude', type: 'number', isOptional: true },
                { name: 'longitude', type: 'number', isOptional: true },
                { name: 'deployment_start', type: 'number' },
                { name: 'deployment_end', type: 'number' },
                { name: 'deployment_comments', type: 'string', isOptional: true },
                { name: 'camera_location_description', type: 'string', isOptional: true },
                { name: 'camera_location_image_path', type: 'string', isOptional: true },
                { name: 'deployment_photos', type: 'string' }, // JSON stored as string
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'users',
            columns: [
                { name: 'firstname', type: 'string' },
                { name: 'surname', type: 'string' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'organisations',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'slug', type: 'string' },
                { name: 'created_by', type: 'string', isOptional: true },
                { name: 'is_active', type: 'boolean' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'devices',
            columns: [
                { name: 'bluetooth_id', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'battery_level', type: 'number' },
                { name: 'organisation_id', type: 'string' },
                { name: 'firmware_id', type: 'string' },
                { name: 'last_battery_check', type: 'string' },
                { name: 'last_sd_card_check', type: 'string' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'user_roles',
            columns: [
                { name: 'user_id', type: 'string', isIndexed: true },
                { name: 'role', type: 'string' }, // 'ww_admin', 'project_admin', 'project_member'
                { name: 'scope_type', type: 'string' }, // 'global', 'organisation', 'project'
                { name: 'scope_id', type: 'string', isOptional: true, isIndexed: true },
                { name: 'granted_by', type: 'string' },
                { name: 'granted_at', type: 'number' },
                { name: 'expires_at', type: 'number', isOptional: true },
                { name: 'is_active', type: 'boolean' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'project_invitations',
            columns: [
                { name: 'remote_id', type: 'string', isIndexed: true },
                { name: 'project_id', type: 'string', isIndexed: true },
                { name: 'inviter_id', type: 'string' },
                { name: 'invitee_email', type: 'string', isIndexed: true },
                { name: 'invitee_id', type: 'string', isOptional: true },
                { name: 'role', type: 'string' },
                { name: 'status', type: 'string', isIndexed: true },
                { name: 'expires_at', type: 'number' },
                { name: 'responded_at', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'firmware',
            columns: [
                { name: 'version', type: 'string' },
                { name: 'type', type: 'string', isIndexed: true }, // 'ble', 'himax', 'config'
                { name: 'location_path', type: 'string' },
                { name: 'file_size_bytes', type: 'number' },
                { name: 'release_notes', type: 'string', isOptional: true },
                { name: 'is_active', type: 'boolean' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        // Reference Data Tables (Read-only, synced from Supabase)
        tableSchema({
            name: 'capture_methods',
            columns: [
                { name: 'server_id', type: 'number' }, // Original ID from Supabase
                { name: 'value', type: 'string' },
                { name: 'description', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'activity_sensitivity',
            columns: [
                { name: 'server_id', type: 'number' }, // Original ID from Supabase
                { name: 'value', type: 'string' },
                { name: 'description', type: 'string' },
                { name: 'is_active', type: 'boolean' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'ai_models',
            columns: [
                { name: 'server_id', type: 'string' }, // Original UUID from Supabase
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'organisation_id', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'sampling_designs',
            columns: [
                { name: 'server_id', type: 'number' }, // Original ID from Supabase
                { name: 'value', type: 'string' },
                { name: 'description', type: 'string' },
                { name: 'is_active', type: 'boolean' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        // Device Preparation Table
        tableSchema({
            name: 'device_preparation',
            columns: [
                { name: 'device_id', type: 'string', isIndexed: true },
                { name: 'project_id', type: 'string', isIndexed: true },
                { name: 'ai_model_id', type: 'string', isOptional: true },
                { name: 'firmware_id', type: 'string', isOptional: true },
                { name: 'status', type: 'string', isIndexed: true }, // in_progress, completed, cancelled
                { name: 'is_deployment_ready', type: 'boolean' },
                // Check results (boolean flags)
                { name: 'battery_check_passed', type: 'boolean' },
                { name: 'camera_view_test_passed', type: 'boolean' },
                { name: 'firmware_check_passed', type: 'boolean' },
                { name: 'sd_card_check_passed', type: 'boolean' },
                { name: 'firmware_updated', type: 'boolean' },
                // LoRaWAN fields
                { name: 'device_eui', type: 'string', isOptional: true },
                { name: 'lorawan_network', type: 'string', isOptional: true },
                { name: 'lorawan_registration_completed', type: 'boolean' },
                { name: 'modified_by', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                // Sync tracking fields
                { name: '_version', type: 'number' },
                { name: '_custom_sync_status', type: 'string', isOptional: true },
            ],
        }),
        // Sync Infrastructure Tables
        tableSchema({
            name: 'sync_outbox',
            columns: [
                { name: 'operation_id', type: 'string', isIndexed: true },
                { name: 'operation_type', type: 'string' }, // CREATE/UPDATE/DELETE
                { name: 'table_name', type: 'string', isIndexed: true },
                { name: 'record_id', type: 'string', isIndexed: true },
                { name: 'payload', type: 'string' }, // JSON serialized change
                { name: 'version', type: 'number' }, // Version counter for conflict detection
                { name: 'lamport_clock', type: 'number' }, // For ordering
                { name: 'retry_count', type: 'number' },
                { name: 'status', type: 'string', isIndexed: true }, // pending/syncing/synced/failed/conflict
                { name: 'error_message', type: 'string', isOptional: true },
                { name: 'user_id', type: 'string', isOptional: true },
                { name: 'device_id', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'sync_state',
            columns: [
                { name: 'key', type: 'string', isIndexed: true },
                { name: 'value', type: 'string' }, // Stored as JSON string
                { name: 'updated_at', type: 'number' },
            ],
        }),
    ],
})
