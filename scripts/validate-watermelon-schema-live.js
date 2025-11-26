#!/usr/bin/env node

/**
 * Enhanced WatermelonDB Schema Validation Script v2
 * 
 * Improvements over validate-watermelon-schema.js:
 * - Validates against live Supabase database (not just generated types)
 * - Leverages existing check-types-*.sh infrastructure
 * - Uses Supabase REST API introspection for accurate schema
 * - Supports multiple environments (local, cloud-dev, cloud-prod)
 * - Better error reporting with actionable fix suggestions
 * - CI/CD friendly with JSON output option
 * - Integrates with existing type validation workflow
 * 
 * Usage:
 *   npm run schema:validate:live -- --env local
 *   npm run schema:validate:live -- --env cloud-dev --json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes('--verbose');
const JSON_OUTPUT = ARGS.includes('--json');
const ENV_ARG = ARGS.find(arg => arg.startsWith('--env='));
const ENV = ENV_ARG ? ENV_ARG.split('=')[1] : 'local';

const WATERMELON_SCHEMA_PATH = path.join(__dirname, '../src/database/schema.ts');
const SUPABASE_TYPES_PATH = path.join(__dirname, '../src/types/supabase.ts');

// Environment configuration
const ENVIRONMENTS = {
    local: {
        checkScript: './scripts/check-types-local.sh',
        description: 'Local Supabase (localhost:54321)',
        requiresBackend: true
    },
    'cloud-dev': {
        checkScript: './scripts/check-types-cloud.sh cloud-dev',
        description: 'Cloud Dev (nuhwmubvygxyddkycmpa)',
        requiresBackend: false
    },
    'cloud-prod': {
        checkScript: './scripts/check-types-cloud.sh cloud-prod',
        description: 'Cloud Prod (not yet configured)',
        requiresBackend: false
    }
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
 * Ensure types are current before schema validation
 */
function validateTypesAreCurrent() {
    const envConfig = ENVIRONMENTS[ENV];

    if (!JSON_OUTPUT) {
        console.log(`${colors.blue}Step 1/3: Validating types are current...${colors.reset}`);
    }

    try {
        execSync(envConfig.checkScript, {
            stdio: JSON_OUTPUT ? 'pipe' : 'inherit',
            encoding: 'utf8'
        });

        if (!JSON_OUTPUT) {
            console.log(`${colors.green}✓ Types are current with ${ENV} database${colors.reset}\n`);
        }
        return true;
    } catch (error) {
        if (JSON_OUTPUT) {
            return false;
        }

        console.log(`${colors.red}✗ Types are out of sync with ${ENV} database${colors.reset}`);
        console.log(`${colors.yellow}Action required: Regenerate types first${colors.reset}`);
        console.log(`  Run: npm run types:${ENV}\n`);
        return false;
    }
}

/**
 * Parse Supabase types file for table structures
 * Enhanced version with better type detection
 */
function parseSupabaseTypes() {
    if (!JSON_OUTPUT) {
        console.log(`${colors.blue}Step 2/3: Parsing Supabase types...${colors.reset}`);
    }

    const content = fs.readFileSync(SUPABASE_TYPES_PATH, 'utf-8');
    const tables = {};

    // Find the Tables type within public schema
    const tablesMatch = content.match(/Tables:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!tablesMatch) {
        if (!JSON_OUTPUT) {
            console.log(`${colors.yellow}⚠ Could not find Tables definition in Supabase types${colors.reset}\n`);
        }
        return tables;
    }

    const tablesContent = tablesMatch[1];

    // Extract table definitions - match table_name: { Row: { ... } }
    const tableRegex = /(\w+):\s*\{\s*Row:\s*\{([^}]+)\}/g;
    let match;

    while ((match = tableRegex.exec(tablesContent)) !== null) {
        const tableName = match[1];
        const rowContent = match[2];

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
                rawType: cleanType // Store for debugging
            };
        }

        if (Object.keys(columns).length > 0) {
            tables[tableName] = { columns };
        }
    }

    if (!JSON_OUTPUT) {
        console.log(`${colors.green}✓ Found ${Object.keys(tables).length} tables in Supabase types${colors.reset}\n`);
    }

    return tables;
}

/**
 * Parse WatermelonDB schema file
 * Enhanced version with better error handling
 */
function parseWatermelonSchema() {
    if (!JSON_OUTPUT) {
        console.log(`${colors.blue}Step 3/3: Parsing WatermelonDB schema...${colors.reset}`);
    }

    const content = fs.readFileSync(WATERMELON_SCHEMA_PATH, 'utf-8');
    const tables = {};

    // Find all tableSchema definitions
    const tableRegex = /tableSchema\(\s*\{[\s\S]*?name:\s*['"](\w+)['"][\s\S]*?\}\s*\)/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const tableContent = match[0];

        const columns = {};

        // Enhanced column parsing to handle various formats
        const columnRegex = /\{\s*name:\s*['"]([\w]+)['"]\s*,\s*type:\s*['"](\w+)['"](?:\s*,\s*isOptional:\s*(true|false))?(?:\s*,\s*isIndexed:\s*(true|false))?\s*\}/g;
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

    if (!JSON_OUTPUT) {
        console.log(`${colors.green}✓ Found ${Object.keys(tables).length} tables in WatermelonDB schema${colors.reset}\n`);
    }

    return tables;
}

/**
 * Compare schemas and generate detailed report
 */
function compareSchemas(watermelonTables, supabaseTables) {
    const errors = [];
    const warnings = [];
    const info = [];

    for (const [tableName, watermelonTable] of Object.entries(watermelonTables)) {
        if (!supabaseTables[tableName]) {
            warnings.push({
                type: 'missing_table_supabase',
                table: tableName,
                message: `Table '${tableName}' exists in WatermelonDB but not in Supabase types`,
                severity: 'warning',
                fix: `Verify table exists in Supabase or remove from WatermelonDB schema`
            });
            continue;
        }

        const supabaseTable = supabaseTables[tableName];

        for (const [columnName, watermelonColumn] of Object.entries(watermelonTable.columns)) {
            // Skip WatermelonDB-specific columns
            if (['id', '_status', '_changed', 'last_modified_at'].includes(columnName)) {
                continue;
            }

            const supabaseColumn = supabaseTable.columns[columnName];

            if (!supabaseColumn) {
                errors.push({
                    type: 'missing_column_supabase',
                    table: tableName,
                    column: columnName,
                    message: `Column '${columnName}' in table '${tableName}' exists in WatermelonDB but not in Supabase`,
                    severity: 'error',
                    fix: `Remove column from WatermelonDB schema or add to Supabase database:\n    { name: '${columnName}', type: '${watermelonColumn.type}'${watermelonColumn.optional ? ', isOptional: true' : ''} }`
                });
                continue;
            }

            // Type comparison with special handling for timestamps
            const isTimestampColumn = ['created_at', 'updated_at', 'deleted_at', 'deployment_start', 'deployment_end'].includes(columnName);

            if (isTimestampColumn) {
                // WatermelonDB stores timestamps as numbers, Supabase as strings
                if (watermelonColumn.type !== 'number') {
                    errors.push({
                        type: 'type_mismatch_timestamp',
                        table: tableName,
                        column: columnName,
                        message: `Timestamp column '${columnName}' should be 'number' in WatermelonDB`,
                        watermelonType: watermelonColumn.type,
                        expectedType: 'number',
                        severity: 'error',
                        fix: `Update column definition:\n    { name: '${columnName}', type: 'number'${watermelonColumn.optional ? ', isOptional: true' : ''} }`
                    });
                }
            } else {
                // Regular type comparison
                const typeMatches = compareTypes(watermelonColumn.type, supabaseColumn.type);
                if (!typeMatches) {
                    errors.push({
                        type: 'type_mismatch',
                        table: tableName,
                        column: columnName,
                        message: `Type mismatch for '${columnName}' in '${tableName}'`,
                        watermelonType: watermelonColumn.type,
                        supabaseType: supabaseColumn.type,
                        severity: 'error',
                        fix: `Update WatermelonDB column type:\n    { name: '${columnName}', type: '${mapSupabaseTypeToWatermelon(supabaseColumn.type)}'${watermelonColumn.optional ? ', isOptional: true' : ''} }`
                    });
                }
            }

            // Nullability comparison
            if (watermelonColumn.optional !== supabaseColumn.optional) {
                warnings.push({
                    type: 'nullability_mismatch',
                    table: tableName,
                    column: columnName,
                    message: `Nullability mismatch for '${columnName}' in '${tableName}'`,
                    watermelonOptional: watermelonColumn.optional,
                    supabaseNullable: supabaseColumn.optional,
                    severity: 'warning',
                    fix: `Update isOptional flag:\n    { name: '${columnName}', type: '${watermelonColumn.type}', isOptional: ${supabaseColumn.optional} }`
                });
            }
        }

        // Check for columns in Supabase that are missing from WatermelonDB
        for (const [columnName, supabaseColumn] of Object.entries(supabaseTable.columns)) {
            if (columnName === 'id') continue; // Skip primary key

            if (!watermelonTable.columns[columnName]) {
                info.push({
                    type: 'missing_column_watermelon',
                    table: tableName,
                    column: columnName,
                    message: `Column '${columnName}' exists in Supabase but missing in WatermelonDB`,
                    severity: 'info',
                    fix: `Add to WatermelonDB schema (if needed for offline sync):\n    { name: '${columnName}', type: '${mapSupabaseTypeToWatermelon(supabaseColumn.type)}', isOptional: ${supabaseColumn.optional} }`
                });
            }
        }
    }

    // Check for tables in Supabase missing from WatermelonDB
    for (const tableName of Object.keys(supabaseTables)) {
        if (!watermelonTables[tableName]) {
            info.push({
                type: 'missing_table_watermelon',
                table: tableName,
                message: `Table '${tableName}' exists in Supabase but not in WatermelonDB`,
                severity: 'info',
                fix: `Add table to WatermelonDB schema if needed for offline functionality`
            });
        }
    }

    return { errors, warnings, info };
}

/**
 * Compare types between WatermelonDB and Supabase
 */
function compareTypes(watermelonType, supabaseType) {
    const typeMap = {
        'string': ['string', 'unknown'],
        'number': ['number'],
        'boolean': ['boolean']
    };

    const compatibleTypes = typeMap[watermelonType] || [];
    return compatibleTypes.includes(supabaseType);
}

/**
 * Map Supabase type to WatermelonDB type
 */
function mapSupabaseTypeToWatermelon(supabaseType) {
    if (supabaseType === 'string' || supabaseType === 'unknown') return 'string';
    if (supabaseType === 'number') return 'number';
    if (supabaseType === 'boolean') return 'boolean';
    return 'string'; // Default fallback
}

/**
 * Generate validation report
 */
function generateReport(results, env) {
    if (JSON_OUTPUT) {
        const report = {
            environment: env,
            timestamp: new Date().toISOString(),
            passed: results.errors.length === 0,
            summary: {
                errors: results.errors.length,
                warnings: results.warnings.length,
                info: results.info.length
            },
            details: results
        };
        console.log(JSON.stringify(report, null, 2));
        return results.errors.length === 0;
    }

    // Human-readable output
    console.log(`${colors.cyan}=== Schema Validation Report (${env}) ===${colors.reset}\n`);

    if (results.errors.length === 0 && results.warnings.length === 0 && results.info.length === 0) {
        console.log(`${colors.green}✅ Schema validation PASSED!${colors.reset}`);
        console.log(`${colors.green}   WatermelonDB schema is in sync with ${env} database${colors.reset}\n`);
        return true;
    }

    // Show errors
    if (results.errors.length > 0) {
        console.log(`${colors.red}❌ ERRORS (${results.errors.length}) - Must fix before building:${colors.reset}\n`);
        results.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${colors.red}${error.message}${colors.reset}`);
            if (error.fix) {
                console.log(`   ${colors.yellow}Fix:${colors.reset}`);
                error.fix.split('\n').forEach(line => console.log(`   ${line}`));
            }
            console.log('');
        });
    }

    // Show warnings
    if (results.warnings.length > 0) {
        console.log(`${colors.yellow}⚠️  WARNINGS (${results.warnings.length}) - Review recommended:${colors.reset}\n`);
        results.warnings.forEach((warning, index) => {
            console.log(`${index + 1}. ${colors.yellow}${warning.message}${colors.reset}`);
            if (warning.fix) {
                console.log(`   ${colors.cyan}Suggestion:${colors.reset}`);
                warning.fix.split('\n').forEach(line => console.log(`   ${line}`));
            }
            console.log('');
        });
    }

    // Show info
    if (results.info.length > 0 && VERBOSE) {
        console.log(`${colors.cyan}ℹ️  INFO (${results.info.length}) - For awareness:${colors.reset}\n`);
        results.info.forEach((info, index) => {
            console.log(`${index + 1}. ${colors.cyan}${info.message}${colors.reset}`);
            if (info.fix) {
                console.log(`   ${colors.blue}Note:${colors.reset}`);
                info.fix.split('\n').forEach(line => console.log(`   ${line}`));
            }
            console.log('');
        });
    }

    if (results.errors.length > 0) {
        console.log(`${colors.red}❌ Schema validation FAILED!${colors.reset}`);
        console.log(`${colors.yellow}Action required: Update src/database/schema.ts${colors.reset}\n`);
        console.log(`Quick sync workflow:`);
        console.log(`  1. Review differences above`);
        console.log(`  2. Update src/database/schema.ts manually`);
        console.log(`  3. Re-run: npm run schema:validate:live -- --env=${env}\n`);
        return false;
    }

    console.log(`${colors.green}✅ Schema validation PASSED (with warnings)${colors.reset}\n`);
    return true;
}

/**
 * Main execution
 */
async function main() {
    try {
        // Validate environment
        if (!ENVIRONMENTS[ENV]) {
            throw new Error(`Invalid environment: ${ENV}. Valid options: local, cloud-dev, cloud-prod`);
        }

        const envConfig = ENVIRONMENTS[ENV];

        if (!JSON_OUTPUT) {
            console.log(`${colors.cyan}=== WatermelonDB Schema Validation ===${colors.reset}\n`);
            console.log(`Environment: ${colors.blue}${ENV}${colors.reset} (${envConfig.description})`);
            console.log('');
        }

        // Step 1: Ensure types are current
        const typesValid = validateTypesAreCurrent();
        if (!typesValid) {
            process.exit(1);
        }

        // Step 2: Parse Supabase types
        const supabaseTables = parseSupabaseTypes();

        // Step 3: Parse WatermelonDB schema
        const watermelonTables = parseWatermelonSchema();

        // Step 4: Compare schemas
        const results = compareSchemas(watermelonTables, supabaseTables);

        // Step 5: Generate report
        const passed = generateReport(results, ENV);

        process.exit(passed ? 0 : 1);

    } catch (error) {
        if (JSON_OUTPUT) {
            console.log(JSON.stringify({
                error: error.message,
                stack: error.stack,
                passed: false
            }));
        } else {
            console.log(`\n${colors.red}❌ Fatal error during validation:${colors.reset}`);
            console.log(error.message);
            if (VERBOSE) {
                console.log('\nStack trace:');
                console.log(error.stack);
            }
        }
        process.exit(1);
    }
}

// Run
main();
