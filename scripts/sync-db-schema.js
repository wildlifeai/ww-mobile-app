/**
 * sync-db-schema.js
 * 
 * Automatically syncs the Supabase database schema from the backend repository
 * to ensure the mobile app's local database matches the source of truth.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Configuration
const MOBILE_SUPABASE_PATH = path.resolve(__dirname, '../supabase');
const SCHEMA_MAP = [
    'schemas/public/tables',
    'schemas/public/functions',
    'schemas/public/policies',
];

// Files that should NEVER be deleted even if they don't exist in the backend
const PRESERVE_FILES = [
    '01_watermelon_sync.sql',
    '99_push_changes.sql',
    '01_auth_user_trigger.sql'
];

const GITHUB_REPO_URL = 'https://github.com/wildlifeai/wildlife-watcher-backend.git';
const TEMP_DIR = path.resolve(__dirname, '../.tmp-backend');

// Potential local backend paths to check (Relative + Home Dir)
const POTENTIAL_PATHS = [
    process.env.WILDLIFE_WATCHER_BACKEND_PATH,                        // 1. Env Variable
    path.resolve(__dirname, '../../wildlife-watcher-backend'),        // 2. Sibling folder
    path.resolve(__dirname, '../../Wildlife-Watcher/wildlife-watcher-backend'), // 3. Grouped sibling
    path.resolve(__dirname, '../../../wildlife-watcher-backend'),     // 4. One level up sibling
    path.join(os.homedir(), 'Wildlife-Watcher/wildlife-watcher-backend'), // 5. Home Dir Grouped
    path.join(os.homedir(), 'dev/wildlife-watcher-backend'),          // 6. Home Dir Dev
    path.join(os.homedir(), 'Documents/wildlife-watcher-backend'),    // 7. Home Dir Documents
].filter(Boolean);

console.log('🔄 Starting Database Schema Sync...');

// 1. Resolve and verify backend path
let effectiveBackendPath = null;
let isTemporary = false;

// Try to find local backend
for (const p of POTENTIAL_PATHS) {
    if (fs.existsSync(p)) {
        effectiveBackendPath = p;
        console.log(`📂 Found local backend repository at: ${effectiveBackendPath}`);
        break;
    }
}

// Fallback to GitHub Clone
if (!effectiveBackendPath) {
    console.log(`⚠️ Warning: local backend repository not found in common locations.`);
    console.log(`📡 Attempting to fetch from GitHub: ${GITHUB_REPO_URL}...`);

    try {
        if (fs.existsSync(TEMP_DIR)) {
            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        }

        execSync(`git clone --depth 1 ${GITHUB_REPO_URL} "${TEMP_DIR}"`, { stdio: 'inherit' });

        effectiveBackendPath = TEMP_DIR;
        isTemporary = true;
        console.log('✅ Temporary backend repository prepared.');
    } catch (error) {
        console.error(`❌ Error: failed to clone backend repository from GitHub: ${error.message}`);
        process.exit(1);
    }
}

// 2. Sync Schema Files
SCHEMA_MAP.forEach(schemaPath => {
    const srcDir = path.join(effectiveBackendPath, 'supabase', schemaPath);
    const destDir = path.join(MOBILE_SUPABASE_PATH, schemaPath);

    if (!fs.existsSync(srcDir)) {
        console.warn(`⚠️ Warning: Source directory ${srcDir} does not exist. Skipping.`);
        return;
    }

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`📦 Syncing ${schemaPath}...`);

    const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.sql'));
    const destFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.sql'));

    // Clean Sync
    destFiles.forEach(file => {
        const isDeperecated = !srcFiles.includes(file);
        const isProtected = PRESERVE_FILES.includes(file);

        if (isDeperecated) {
            if (isProtected) {
                console.log(`🛡️ Preserving mobile-specific file: ${path.join(schemaPath, file)}`);
            } else {
                console.log(`🗑️ Removing deprecated file: ${path.join(schemaPath, file)}`);
                fs.unlinkSync(path.join(destDir, file));
            }
        }
    });

    // Copy Updates
    srcFiles.forEach(file => {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);
        fs.copyFileSync(srcFile, destFile);
    });
});

console.log('✅ Schema sync complete!');

if (isTemporary && fs.existsSync(TEMP_DIR)) {
    console.log('🧹 Cleaning up temporary files...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

console.log('💡 Run "npx supabase db reset" to apply changes locally.');
