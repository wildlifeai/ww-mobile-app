#!/usr/bin/env node

/**
 * WatermelonDB Schema Validation Script
 * 
 * Validates that the WatermelonDB schema (src/database/schema.ts) matches
 * the Supabase schema (src/types/supabase.ts) to prevent schema drift.
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

            if (cleanType.includes('string')) {
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

    log(`\n${colors.cyan}Validating WatermelonDB schema against Supabase types...${colors.reset}\n`);

    // Check each WatermelonDB table
    for (const [tableName, watermelonTable] of Object.entries(watermelonTables)) {
        if (VERBOSE) {
            log(`${colors.blue}Checking table: ${tableName}${colors.reset}`);
        }

        // Check if table exists in Supabase
        if (!supabaseTables[tableName]) {
            warnings.push(`Table '${tableName}' exists in WatermelonDB but not in Supabase types`);
            continue;
        }

        const supabaseTable = supabaseTables[tableName];

        // Check each column
        for (const [columnName, watermelonColumn] of Object.entries(watermelonTable.columns)) {
            // Skip WatermelonDB-specific columns
            if (['id', '_status', '_changed', 'last_modified_at', '_version', '_custom_sync_status', 'modified_by', 'deleted_at', 'created_at', 'updated_at'].includes(columnName)) {
                continue;
            }

            // Map timestamp columns (WatermelonDB stores as number, Supabase as string)
            const isTimestampColumn = ['created_at', 'updated_at', 'deleted_at', 'deployment_start', 'deployment_end'].includes(columnName);

            if (!supabaseTable.columns[columnName]) {
                errors.push(`Table '${tableName}': Column '${columnName}' exists in WatermelonDB but not in Supabase`);
                continue;
            }

            const supabaseColumn = supabaseTable.columns[columnName];

            // Compare types (with special handling for timestamps)
            const watermelonType = watermelonColumn.type;
            const supabaseType = supabaseColumn.type;

            if (isTimestampColumn) {
                // Timestamps: WatermelonDB uses 'number' (epoch ms), Supabase uses 'string' (ISO)
                if (watermelonType !== 'number') {
                    errors.push(`Table '${tableName}': Column '${columnName}' should be 'number' in WatermelonDB (timestamp), got '${watermelonType}'`);
                }
            } else {
                // Regular columns
                const expectedSupabaseType = mapWatermelonTypeToSupabase(watermelonType);
                if (supabaseType !== expectedSupabaseType && supabaseType !== 'unknown') {
                    errors.push(`Table '${tableName}': Column '${columnName}' type mismatch - WatermelonDB: '${watermelonType}', Supabase: '${supabaseType}'`);
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

    return { errors, warnings };
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

        log('Parsing Supabase types...');
        const supabaseTables = parseSupabaseTypes();
        log(`  Found ${Object.keys(supabaseTables).length} tables\n`);

        // Validate
        const { errors, warnings } = validateSchemas(watermelonTables, supabaseTables);

        // Report results
        log(`\n${colors.cyan}=== Validation Results ===${colors.reset}\n`);

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
            log(`${colors.yellow}Action required: Update src/database/schema.ts to match Supabase schema${colors.reset}\n`);
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
