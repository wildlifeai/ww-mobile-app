import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
    version: 2,
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
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'deleted_at', type: 'number' },
                { name: 'created_by', type: 'string', isOptional: true },
                { name: 'modified_by', type: 'string', isOptional: true },
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
    ],
})
