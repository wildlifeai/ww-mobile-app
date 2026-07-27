const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 Syncing Supabase Types from Cloud...');

const ROOT = path.resolve(__dirname, '../');

// In CI (or with --strict) a failed type sync must fail the build — silently
// shipping stale types is exactly the schema drift this script exists to catch.
// On a developer machine it degrades to a warning so an offline or not-yet-
// configured checkout can still build and run on a USB device.
const STRICT = process.argv.includes('--strict') || !!process.env.CI;

const fail = (message, hint) => {
    console.error(`❌ ${message}`);
    if (hint) console.error(`   ${hint}`);
    if (STRICT) process.exit(1);
    console.warn('⚠️  Proceeding with the committed src/types/database.types.ts.');
    console.warn('   Run `npm run types:cloud-dev` again once configured to refresh them.');
    process.exit(0);
};

// Env file candidates, most specific first. `.env.development` stays canonical;
// `.env.local` and `.env` are accepted because that is what .env.example and
// Expo's own dot-env loading tell developers to create.
const candidates = process.env.NODE_ENV === 'production'
    ? ['.env.production']
    : ['.env.development', '.env.local', '.env'];

const envFile = candidates.find((name) => fs.existsSync(path.resolve(ROOT, name)));

// The URL may also come straight from the process environment (CI, EAS, or a
// developer who exports it in their shell) — no file needed in that case.
let supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
let source = 'process environment';

if (!supabaseUrl) {
    if (!envFile) {
        fail(
            `No environment file found (looked for: ${candidates.join(', ')}).`,
            'Fix: cp .env.example .env.development  — then fill in EXPO_PUBLIC_SUPABASE_ANON_KEY',
        );
    }

    const envContent = fs.readFileSync(path.resolve(ROOT, envFile), 'utf8');
    // Extract Supabase URL (ignoring commented lines)
    const urlMatch = envContent.match(
        /^[ \t]*EXPO_PUBLIC_SUPABASE_URL=(https:\/\/[a-z0-9]+\.supabase\.co)/m,
    );

    if (!urlMatch) {
        fail(
            `EXPO_PUBLIC_SUPABASE_URL not found or invalid in ${envFile}.`,
            'Expected a line like: EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co',
        );
    }

    supabaseUrl = urlMatch[1];
    source = envFile;
}

// Extract project ID from URL: https://<ref>.supabase.co -> <ref>
const projectIdMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);

if (!projectIdMatch) {
    fail(`Could not extract Project ID from URL: ${supabaseUrl}`);
}

const projectId = projectIdMatch[1];
console.log(`✅ Extracted Project ID: ${projectId} from ${source}`);

try {
    const cmd = `npx -y supabase gen types typescript --project-id ${projectId} --schema public > src/types/database.types.ts`;
    console.log(`Executing: npx supabase gen types typescript --project-id ${projectId} ...`);

    execSync(cmd, { stdio: 'inherit', cwd: ROOT });

    console.log('✅ Successfully generated database types!');
} catch (error) {
    console.error('❌ Failed to generate database types.');
    console.log('⚠️  If your project is paused due to inactivity, wake it up via the Supabase Dashboard.');
    if (STRICT) process.exit(1);
    // Do not fail a local build just because the database is asleep
    console.warn('⚠️  Proceeding with existing types...');
}
