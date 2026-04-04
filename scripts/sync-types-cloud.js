const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 Syncing Supabase Types from Cloud...');

// Determine environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '../', envFile);

if (!fs.existsSync(envPath)) {
    console.error(`❌ Environment file not found at ${envPath}`);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');

// Extract Supabase URL (ignoring commented lines)
const urlMatch = envContent.match(/^[ \t]*EXPO_PUBLIC_SUPABASE_URL=(https:\/\/[a-z0-9]+\.supabase\.co)/m);
if (!urlMatch || !urlMatch[1]) {
    console.error(`❌ EXPO_PUBLIC_SUPABASE_URL not found or invalid in ${envFile}`);
    process.exit(1);
}

const supabaseUrl = urlMatch[1];
// Extract project ID from URL: https://qegeovogqxiouqbrxmnh.supabase.co -> qegeovogqxiouqbrxmnh
const projectIdMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);

if (!projectIdMatch || !projectIdMatch[1]) {
    console.error(`❌ Could not extract Project ID from URL: ${supabaseUrl}`);
    process.exit(1);
}

const projectId = projectIdMatch[1];
console.log(`✅ Extracted Project ID: ${projectId} from ${envFile}`);

try {
    const cmd = `npx -y supabase gen types typescript --project-id ${projectId} --schema public > src/types/database.types.ts`;
    console.log(`Executing: npx supabase gen types typescript --project-id ${projectId} ...`);
    
    execSync(cmd, { 
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../')
    });
    
    console.log('✅ Successfully generated database types!');
} catch (error) {
    console.error('❌ Failed to generate database types.');
    console.log('⚠️  If your project is paused due to inactivity, you may need to wake it up via the Supabase Dashboard.');
    // Do not fail the whole build if the database is asleep, just warn
    console.warn('⚠️  Proceeding with existing types...');
    // process.exit(1); // Removed so android build can continue even if DB is asleep
}
