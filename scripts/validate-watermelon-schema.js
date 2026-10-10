#!/usr/bin/env node

/**
 * WatermelonDB Schema Validation Script
 *
 * Validates that the WatermelonDB schema (src/database/schema.ts) matches
 * the Supabase types (src/types/supabase.ts, or src/types/database.types.ts
 * while supabase.ts is empty) to prevent schema drift.
 *
 * Every deliberate difference is named in the allowlists below, table and
 * column, never by pattern, and each is explained in scripts/README.md.
 *
 * Usage:
 *   node scripts/validate-watermelon-schema.js
 *   node scripts/validate-watermelon-schema.js --verbose
 */

const fs = require('fs');
const path = require('path');

// Configuration
const VERBOSE = process.argv.includes('--verbose');
const WATERMELON_SCHEMA_PATH = path.join(__dirname, '../src/database/schema.ts');
let SUPABASE_TYPES_PATH = path.join(__dirname, '../src/types/supabase.ts');
if (!fs.existsSync(SUPABASE_TYPES_PATH) || fs.statSync(SUPABASE_TYPES_PATH).size === 0) {
    SUPABASE_TYPES_PATH = path.join(__dirname, '../src/types/database.types.ts');
}

// Columns on every table that are not compared: WatermelonDB's own, and the sync
// fields generate-watermelon-schema.js adds to each table (SYNC_FIELDS there).
const SYSTEM_COLUMNS = ['id', '_status', '_changed', 'last_modified_at', '_version', '_custom_sync_status', 'modified_by', 'deleted_at', 'created_at', 'updated_at'];

// Tables that exist only on the phone. A table not named here that is missing
// from the Supabase types is an error.
const LOCAL_ONLY_TABLES = {
    sync_outbox: 'the queue of changes waiting to upload (models/SyncOutbox.ts)',
    sync_state: 'sync bookkeeping, such as the pull watermarks (models/SyncState.ts)',
};

// Columns that exist only on the phone, by table. Exact names: a pattern such as
// "*_id" could hide a real column dropped upstream. Each entry must still be
// missing from Supabase, or the validator asks for it to be removed from here.
const LOCAL_ONLY_COLUMNS = {
    activity_sensitivity: { server_id: 'the integer Supabase id, since a WatermelonDB id is a string (ReferenceDataService)' },
    ai_models: { server_id: 'the Supabase uuid, kept beside the local id (ReferenceDataService)' },
    capture_methods: { server_id: 'the integer Supabase id, since a WatermelonDB id is a string (ReferenceDataService)' },
    sampling_designs: { server_id: 'the integer Supabase id, since a WatermelonDB id is a string (ReferenceDataService)' },
    project_invitations: { remote_id: 'the Supabase invitation id; the local row has its own id (InvitationService)' },
};

// Timestamps the model reads with @date, which stores epoch milliseconds (a
// number), where Supabase types an ISO string. The pulls convert with new Date().
// Each must be a number here and a string in Supabase, or it is an error: on a
// string column @date keeps nothing (#425). The generator's timestampFields
// makes them numbers.
const TIMESTAMP_COLUMNS = {
    deployments: ['deployment_start', 'deployment_end', 'lorawan_last_verified_at'],
    project_invitations: ['expires_at', 'responded_at'],
    user_roles: ['granted_at', 'expires_at'],
};

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

/**
 * Parse WatermelonDB schema file
 */
function parseWatermelonSchema() {
    const content = fs.readFileSync(WATERMELON_SCHEMA_PATH, 'utf-8');

    const tables = {};
    const tableRegex = /tableSchema\(\{[\s\S]*?name:\s*['"](\w+)['"]/g;
    let match;

    // Find all table definitions
    while ((match = tableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const tableStartIndex = match.index;

        // Find the closing parenthesis for this tableSchema
        let depth = 0;
        let endIndex = tableStartIndex;
        for (let i = tableStartIndex; i < content.length; i++) {
            if (content[i] === '(') depth++;
            if (content[i] === ')') {
                depth--;
                if (depth === 0) {
                    endIndex = i;
                    break;
                }
            }
        }

        const tableContent = content.substring(tableStartIndex, endIndex);

        // Parse columns
        const columns = {};
        const columnRegex = /\{\s*name:\s*['"](\w+)['"],\s*type:\s*['"](\w+)['"](?:,\s*isOptional:\s*(true|false))?\s*(?:,\s*isIndexed:\s*(true|false))?\s*\}/g;
        let columnMatch;

        while ((columnMatch = columnRegex.exec(tableContent)) !== null) {
            const [, columnName, columnType, isOptional] = columnMatch;
            columns[columnName] = {
                type: columnType,
                optional: isOptional === 'true',
            };
        }

        tables[tableName] = { columns };
    }

    return tables;
}

/**
 * Parse Supabase types file for table structures
 */
function parseSupabaseTypes() {
    const content = fs.readFileSync(SUPABASE_TYPES_PATH, 'utf-8');

    const tables = {};

    // Find all table Row definitions
    // Pattern: tableName: {\n    Row: {
    const tableRegex = /(\w+):\s*\{[\s\n]*Row:\s*\{([^}]+)\}/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const rowContent = match[2];

        // Parse column definitions from Row type
        const columns = {};
        const columnRegex = /(\w+):\s*([^;\n]+)/g;
        let columnMatch;

        while ((columnMatch = columnRegex.exec(rowContent)) !== null) {
            const [, columnName, columnType] = columnMatch;
            const cleanType = columnType.trim();

            // Determine base type and nullability
            const isNullable = cleanType.includes('| null');
            let baseType;

            if (cleanType.includes('[]')) {
                // WatermelonDB has no array column, so the generator stores
                // every array as a JSON string (mapType there)
                baseType = 'string';
            } else if (cleanType.includes('string')) {
                baseType = 'string';
            } else if (cleanType.includes('number')) {
                baseType = 'number';
            } else if (cleanType.includes('boolean')) {
                baseType = 'boolean';
            } else if (cleanType.includes('unknown') || cleanType.includes('Json')) {
                baseType = 'string'; // WatermelonDB stores JSON as string
            } else {
                baseType = 'unknown';
            }

            columns[columnName] = {
                type: baseType,
                raw: cleanType.replace(/\s*\|\s*null/, ''),
                optional: isNullable,
            };
        }

        if (Object.keys(columns).length > 0) {
            tables[tableName] = { columns };
        }
    }

    return tables;
}

/**
 * Map WatermelonDB type to Supabase type
 */
function mapWatermelonTypeToSupabase(watermelonType) {
    const mapping = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
    };
    return mapping[watermelonType] || watermelonType;
}

/**
 * Validate schemas
 */
function validateSchemas(watermelonTables, supabaseTables) {
    const errors = [];
    const warnings = [];
    const counts = { tables: 0, columns: 0, localOnlyTables: 0, localOnlyColumns: 0 };

    log(`\n${colors.cyan}Validating WatermelonDB schema against Supabase types...${colors.reset}\n`);

    // An allowlist entry that matches nothing would skip a column nobody has, and
    // one that Supabase now has would hide a column that should be compared.
    for (const tableName of Object.keys(LOCAL_ONLY_TABLES)) {
        if (!watermelonTables[tableName]) {
            errors.push(`Table '${tableName}' is allowlisted as local-only but is not in WatermelonDB: remove it from LOCAL_ONLY_TABLES`);
        } else if (supabaseTables[tableName]) {
            errors.push(`Table '${tableName}' is allowlisted as local-only but now exists in Supabase types: remove it from LOCAL_ONLY_TABLES`);
        }
    }
    for (const [tableName, columns] of Object.entries(LOCAL_ONLY_COLUMNS)) {
        for (const columnName of Object.keys(columns)) {
            if (!watermelonTables[tableName] || !watermelonTables[tableName].columns[columnName]) {
                errors.push(`Table '${tableName}': Column '${columnName}' is allowlisted as local-only but is not in WatermelonDB: remove it from LOCAL_ONLY_COLUMNS`);
            }
        }
    }
    for (const [tableName, columns] of Object.entries(TIMESTAMP_COLUMNS)) {
        for (const columnName of columns) {
            if (!watermelonTables[tableName] || !watermelonTables[tableName].columns[columnName]) {
                errors.push(`Table '${tableName}': Column '${columnName}' is listed in TIMESTAMP_COLUMNS but is not in WatermelonDB: remove it`);
            }
        }
    }

    // Check each WatermelonDB table
    for (const [tableName, watermelonTable] of Object.entries(watermelonTables)) {
        if (VERBOSE) {
            log(`${colors.blue}Checking table: ${tableName}${colors.reset}`);
        }

        // Check if table exists in Supabase
        if (!supabaseTables[tableName]) {
            if (LOCAL_ONLY_TABLES[tableName]) {
                counts.localOnlyTables++;
                if (VERBOSE) {
                    log(`  - local-only table: ${LOCAL_ONLY_TABLES[tableName]}`);
                }
            } else {
                errors.push(`Table '${tableName}' exists in WatermelonDB but not in Supabase types`);
            }
            continue;
        }

        const supabaseTable = supabaseTables[tableName];
        const localOnlyColumns = LOCAL_ONLY_COLUMNS[tableName] || {};
        const timestampColumns = TIMESTAMP_COLUMNS[tableName] || [];
        counts.tables++;

        // Check each column
        for (const [columnName, watermelonColumn] of Object.entries(watermelonTable.columns)) {
            // Skip WatermelonDB-specific columns
            if (SYSTEM_COLUMNS.includes(columnName)) {
                continue;
            }

            if (localOnlyColumns[columnName]) {
                if (supabaseTable.columns[columnName]) {
                    errors.push(`Table '${tableName}': Column '${columnName}' is allowlisted as local-only but now exists in Supabase: remove it from LOCAL_ONLY_COLUMNS`);
                } else {
                    counts.localOnlyColumns++;
                    if (VERBOSE) {
                        log(`  - ${columnName}: local-only, ${localOnlyColumns[columnName]}`);
                    }
                }
                continue;
            }

            if (!supabaseTable.columns[columnName]) {
                errors.push(`Table '${tableName}': Column '${columnName}' exists in WatermelonDB but not in Supabase`);
                continue;
            }

            const supabaseColumn = supabaseTable.columns[columnName];
            counts.columns++;

            // Compare types (with special handling for timestamps)
            const watermelonType = watermelonColumn.type;
            const supabaseType = supabaseColumn.type;

            if (timestampColumns.includes(columnName)) {
                // Timestamps: WatermelonDB uses 'number' (epoch ms), Supabase uses 'string' (ISO)
                if (watermelonType !== 'number' || supabaseType !== 'string') {
                    errors.push(`Table '${tableName}': Column '${columnName}' is a timestamp, expected WatermelonDB 'number' and Supabase 'string', got '${watermelonType}' and '${supabaseType}'`);
                }
            } else {
                // Regular columns
                const expectedSupabaseType = mapWatermelonTypeToSupabase(watermelonType);
                if (supabaseType !== expectedSupabaseType && supabaseType !== 'unknown') {
                    const asTyped = supabaseColumn.raw !== supabaseType ? ` (typed ${supabaseColumn.raw})` : '';
                    errors.push(`Table '${tableName}': Column '${columnName}' type mismatch - WatermelonDB: '${watermelonType}', Supabase: '${supabaseType}'${asTyped}`);
                }
            }

            // Compare nullability
            if (watermelonColumn.optional !== supabaseColumn.optional) {
                const wmOptional = watermelonColumn.optional ? 'optional' : 'required';
                const sbOptional = supabaseColumn.optional ? 'nullable' : 'non-nullable';
                warnings.push(`Table '${tableName}': Column '${columnName}' nullability mismatch - WatermelonDB: ${wmOptional}, Supabase: ${sbOptional}`);
            }

            if (VERBOSE) {
                log(`  ✓ ${columnName}: ${watermelonType}${watermelonColumn.optional ? '?' : ''}`);
            }
        }

        // Check for columns in Supabase that are missing from WatermelonDB
        for (const columnName of Object.keys(supabaseTable.columns)) {
            // Skip system columns that WatermelonDB doesn't need to replicate
            if (['id'].includes(columnName)) {
                continue;
            }

            if (!watermelonTable.columns[columnName]) {
                warnings.push(`Table '${tableName}': Column '${columnName}' exists in Supabase but missing in WatermelonDB (may be intentional)`);
            }
        }
    }

    return { errors, warnings, counts };
}

/**
 * Log message
 */
function log(message) {
    console.log(message);
}

/**
 * Main execution
 */
function main() {
    try {
        log(`${colors.cyan}=== WatermelonDB Schema Validation ===${colors.reset}\n`);

        // Check if files exist
        if (!fs.existsSync(WATERMELON_SCHEMA_PATH)) {
            log(`${colors.red}Error: WatermelonDB schema file not found: ${WATERMELON_SCHEMA_PATH}${colors.reset}`);
            process.exit(1);
        }

        if (!fs.existsSync(SUPABASE_TYPES_PATH)) {
            log(`${colors.red}Error: Supabase types file not found: ${SUPABASE_TYPES_PATH}${colors.reset}`);
            process.exit(1);
        }

        // Parse schemas
        log('Parsing WatermelonDB schema...');
        const watermelonTables = parseWatermelonSchema();
        log(`  Found ${Object.keys(watermelonTables).length} tables\n`);

        log(`Parsing Supabase types (${path.relative(path.join(__dirname, '..'), SUPABASE_TYPES_PATH).split(path.sep).join('/')})...`);
        const supabaseTables = parseSupabaseTypes();
        log(`  Found ${Object.keys(supabaseTables).length} tables\n`);

        // Validate
        const { errors, warnings, counts } = validateSchemas(watermelonTables, supabaseTables);

        // A pass that compared nothing is not a pass (5 September 2026, the live validator)
        if (counts.columns === 0) {
            errors.push('Compared no columns: a parser found nothing, so this run proves nothing');
        }

        // Report results
        log(`\n${colors.cyan}=== Validation Results ===${colors.reset}\n`);
        log(`Compared ${counts.columns} columns across ${counts.tables} tables; skipped by name ${counts.localOnlyTables} local-only tables and ${counts.localOnlyColumns} local-only columns\n`);

        if (warnings.length > 0) {
            log(`${colors.yellow}Warnings (${warnings.length}):${colors.reset}`);
            warnings.forEach(warning => log(`  ⚠  ${warning}`));
            log('');
        }

        if (errors.length > 0) {
            log(`${colors.red}Errors (${errors.length}):${colors.reset}`);
            errors.forEach(error => log(`  ✗ ${error}`));
            log('');
            log(`${colors.red}Schema validation FAILED!${colors.reset}`);
            log(`${colors.yellow}Action required: regenerate src/database/schema.ts with npm run schema:generate, or, for a deliberate difference, name it in this script's allowlists and in scripts/README.md${colors.reset}\n`);
            process.exit(1);
        }

        log(`${colors.green}✓ Schema validation PASSED!${colors.reset}`);
        log(`${colors.green}  WatermelonDB schema is in sync with Supabase types${colors.reset}\n`);
        process.exit(0);

    } catch (error) {
        log(`\n${colors.red}Fatal error during validation:${colors.reset}`);
        log(error.stack);
        process.exit(1);
    }
}

// Run
main();
