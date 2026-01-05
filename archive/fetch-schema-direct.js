const fs = require('fs');
const path = require('path');

async function fetchSchema() {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');

        const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
        // Try to find service role key, fall back to anon key
        let keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
        if (!keyMatch) {
            keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
        }

        if (!urlMatch || !keyMatch) {
            console.error('Could not find Supabase credentials in .env');
            process.exit(1);
        }

        let url = urlMatch[1].trim();
        let key = keyMatch[1].trim();

        // Strip quotes if present
        if (url.startsWith("'") && url.endsWith("'")) url = url.slice(1, -1);
        if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);
        if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
        if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);

        console.log(`Fetching schema from ${url}...`);
        console.log(`Using key: ${key.substring(0, 5)}...`);

        const response = await fetch(`${url}/rest/v1/?apikey=${key}`, {
            headers: {
                'Authorization': `Bearer ${key}`,
                'apikey': key
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            process.exit(1);
        }

        const schema = await response.json();
        console.log(JSON.stringify(schema, null, 2));

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fetchSchema();
