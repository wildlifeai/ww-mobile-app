import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
    version: 4,
    tables: [
        tableSchema({
            name: 'projects',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'organisation_id', type: 'string', isOptional: true },
                { name: 'is_active', type: 'boolean' },
                { name: 'is_baited', type: 'boolean', isOptional: true },
                { name: 'is_monitoring_marked_individuals', type: 'boolean', isOptional: true },
                { name: 'timelapse_interval_seconds', type: 'number', isOptional: true },
                { name: 'project_image', type: 'string', isOptional: true },
                { name: 'website', type: 'string', isOptional: true },
                // Reference fields for offline support
                { name: 'capture_method_id', type: 'number', isOptional: true },
                { name: 'activity_detection_sensitivity_id', type: 'number', isOptional: true },
                { name: 'sampling_design_id', type: 'number', isOptional: true },
                { name: 'model_id', type: 'string', isOptional: true },
                // Audit fields
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                { name: 'created_by', type: 'string', isOptional: true },
                { name: 'modified_by', type: 'string', isOptional: true },
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
                { name: 'location_name', type: 'string' },
                { name: 'latitude', type: 'number', isOptional: true },
                { name: 'longitude', type: 'number', isOptional: true },
                { name: 'deployment_start', type: 'number' },
                { name: 'deployment_end', type: 'number' },
                { name: 'deployment_status_id', type: 'number', isOptional: true },
                { name: 'deployment_comments', type: 'string', isOptional: true },
                { name: 'camera_location_description', type: 'string', isOptional: true },
                { name: 'camera_location_image_path', type: 'string', isOptional: true },
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
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'organisations',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'slug', type: 'string' },
                { name: 'created_by', type: 'string', isOptional: true },
                { name: 'is_active', type: 'boolean' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
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
