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
// Mirrors the backend's own directory names. The aaa_/xxx_/yyy_/zzz_ prefixes encode
// apply order there, so copying them verbatim keeps a local `supabase db reset` correct.
//
// These names are a cross-repo contract: when the backend renamed `policies` ->
// `yyy_policies` this list was not updated, and because a missing source directory was
// only a warning, RLS quietly stopped syncing. The app sat on 21 stale policy files
// while the backend had 38. Missing directories are now fatal — see below.
const SCHEMA_MAP = [
    'schemas/public/tables',
    'schemas/public/functions',
    'schemas/public/triggers',
    'schemas/public/views',
    'schemas/public/xxx_rls',        // ENABLE ROW LEVEL SECURITY — policies do nothing without it
    'schemas/public/yyy_policies',   // was 'schemas/public/policies'
    'schemas/public/zzz_indexes',
    'schemas/public/aaa_default_privileges',
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
    path.resolve(__dirname, '../../ww-backend'),                      // 2. Sibling (short name)
    path.resolve(__dirname, '../../Wildlife-Watcher/ww-backend'),     // 3. Grouped sibling (short name)
    path.resolve(__dirname, '../../wildlife-watcher-backend'),        // 4. Sibling folder
    path.resolve(__dirname, '../../Wildlife-Watcher/wildlife-watcher-backend'), // 5. Grouped sibling
    path.resolve(__dirname, '../../../wildlife-watcher-backend'),     // 6. One level up sibling
    path.join(os.homedir(), 'Wildlife-Watcher/ww-backend'),          // 7. Home Dir Grouped (short name)
    path.join(os.homedir(), 'Wildlife-Watcher/wildlife-watcher-backend'), // 8. Home Dir Grouped
    path.join(os.homedir(), 'dev/wildlife-watcher-backend'),          // 9. Home Dir Dev
    path.join(os.homedir(), 'Documents/wildlife-watcher-backend'),    // 10. Home Dir Documents
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
const missingDirs = [];

SCHEMA_MAP.forEach(schemaPath => {
    const srcDir = path.join(effectiveBackendPath, 'supabase', schemaPath);
    const destDir = path.join(MOBILE_SUPABASE_PATH, schemaPath);

    if (!fs.existsSync(srcDir)) {
        // Fatal, not a warning. This used to skip silently, which is how the app ended
        // up 17 policy files behind the backend without anyone noticing for months.
        console.error(`\n❌ Backend schema directory missing: ${srcDir}`);
        console.error('   The backend layout changed, or your ww-backend checkout is stale.');
        console.error('   Fix: pull ww-backend, then update SCHEMA_MAP in this script to match.');
        // Best-effort hint. The parent may be missing too (wrong or incomplete checkout),
        // and an error handler must never be the thing that crashes.
        const parent = path.join(effectiveBackendPath, 'supabase', 'schemas', 'public');
        try {
            console.error(`   Backend currently has: ${fs.readdirSync(parent).join(', ')}\n`);
        } catch {
            console.error(`   Could not list ${parent} — is this a complete ww-backend checkout?\n`);
        }
        process.exitCode = 1;
        missingDirs.push(schemaPath);
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
        const isDeprecated = !srcFiles.includes(file);
        const isProtected = PRESERVE_FILES.includes(file);

        if (isDeprecated) {
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

if (missingDirs.length > 0) {
    console.error(`❌ Schema sync incomplete — ${missingDirs.length} director(ies) missing: ${missingDirs.join(', ')}`);
} else {
    console.log('✅ Schema sync complete!');
}

if (isTemporary && fs.existsSync(TEMP_DIR)) {
    console.log('🧹 Cleaning up temporary files...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

// Only suggest applying the schema when it is actually complete — a reset against a
// partial sync would build a local database missing tables, policies or RLS.
if (missingDirs.length === 0) {
    console.log('💡 Run "npx supabase db reset" to apply changes locally.');
}
