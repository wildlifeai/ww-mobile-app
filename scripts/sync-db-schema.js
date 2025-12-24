/**
 * sync-db-schema.js
 * 
 * Automatically syncs the Supabase database schema from the backend repository
 * to ensure the mobile app's local database matches the source of truth.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BACKEND_PATH = path.resolve(__dirname, '../../../Users/VictorAnton/Wildlife-Watcher/wildlife-watcher-backend');
const MOBILE_SUPABASE_PATH = path.resolve(__dirname, '../supabase');
const SCHEMA_MAP = [
    'schemas/public/tables',
    'schemas/public/functions',
    'schemas/public/policies',
];

console.log('🔄 Starting Database Schema Sync...');
console.log(`📂 Backend Path: ${BACKEND_PATH}`);

// 1. Verify backend path exists
if (!fs.existsSync(BACKEND_PATH)) {
    console.error(`❌ Error: backend repository not found at ${BACKEND_PATH}`);
    process.exit(1);
}

// 2. Sync Schema Files
SCHEMA_MAP.forEach(schemaPath => {
    const srcDir = path.join(BACKEND_PATH, 'supabase', schemaPath);
    const destDir = path.join(MOBILE_SUPABASE_PATH, schemaPath);

    if (!fs.existsSync(srcDir)) {
        console.warn(`⚠️ Warning: Source directory ${srcDir} does not exist. Skipping.`);
        return;
    }

    // Ensure destination exists
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`📦 Syncing ${schemaPath}...`);

    // Use robocopy for robust sync (Windows) or rsync (Linux/Mac)
    // For simplicity across systems, we'll use a basic FS copy here
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
        if (file.endsWith('.sql')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
    });
});

console.log('✅ Schema sync complete!');
console.log('💡 Run "npx supabase db reset" to apply changes locally.');
