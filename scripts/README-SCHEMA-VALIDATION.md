# WatermelonDB Schema Validation

This validation script ensures your WatermelonDB schema (`src/database/schema.ts`) stays in sync with the Supabase database schema to prevent runtime errors and data inconsistencies.

## Usage

### Manual Validation

```bash
# Run validation
npm run schema:validate

# Run with verbose output
npm run schema:validate:verbose
```

### Automatic Validation

The schema validation runs automatically as part of the pre-build checks:

```bash
npm run prebuild:check
```

## Understanding Validation Results

### Errors (Build-Blocking)

**Errors** indicate critical schema mismatches that will cause runtime issues:
- Column type mismatches (e.g., `string` vs `number`)
- Missing columns that WatermelonDB expects from Sup abase
- Incorrect timestamp column types

**Action**: Update `src/database/schema.ts` to fix the errors.

### Warnings (Informational)

**Warnings** highlight potential issues that may or may not require action:
- Null ability mismatches (e.g., optional in WatermelonDB vs nullable in Supabase)
- Columns in Supabase but missing in WatermelonDB (may be intentional for optimization)
- Tables in WatermelonDB not found in Supabase types

**Action**: Review warnings and update schema if needed.

## Common Scenarios

### Supabase Schema Updated

When the Supabase schema changes:

1. **Regenerate TypeScript types**:
   ```bash
   npm run types:local          # For local development
   npm run types:cloud-dev      # For cloud-dev environment
   ```

2. **Run validation**:
   ```bash
   npm run schema:validate
   ```

3. **Fix errors** by updating `src/database/schema.ts`:
   - Add/remove tables
   - Add/remove columns
   - Update column types
   - Adjust nullability (`isOptional: true/false`)

4. **Test again**:
   ```bash
   npm run schema:validate
   ```

### New Column Added to Supabase

If a new column is added to Supabase that WatermelonDB should sync:

1. Add the column to the appropriate table in `src/database/schema.ts`:
   ```typescript
   tableSchema({
       name: 'projects',
       columns: [
           // ... existing columns ...
           { name: 'new_column', type: 'string', isOptional: true },
       ],
   })
   ```

2. Run validation:
   ```bash
   npm run schema:validate
   ```

## Special Cases

### Timestamp Columns

Timestamp columns (`created_at`, `updated_at`, `deleted_at`, `deployment_start`, `deployment_end`) are handled specially:
- **WatermelonDB**: Stores as `'number'` (epoch milliseconds)
- **Supabase**: Stores as `'string'` (ISO 8601 timestamps)

The validation script automatically accounts for this difference.

### WatermelonDB-Specific Columns

These columns are automatically skipped during validation:
- `id` (managed by WatermelonDB)
- `_status` (sync status)
- `_changed` (change tracking)
- `last_modified_at` (local modification time)

## Troubleshooting

### "Schema validation FAILED" on Build

1. Run verbose validation to see details:
   ```bash
   npm run schema:validate:verbose
   ```

2. Review the error messages

3. Update `src/database/schema.ts` accordingly

4. Re-run validation

### False Positives

If you encounter warnings/errors that are intentional (e.g., you deliberately excluded a column for performance), you can:
1. Document the decision in code comments
2. Create an issue to track future improvements
3. Consider updating the validation script to skip specific known differences

## Integration with Builds

The schema validation is integrated into:
- **Pre-build checks**: `npm run prebuild:check`
- **EAS builds**: Validation runs before preview/production builds

Build will fail if schema validation fails, preventing deployment of apps with schema drift.

## Further Reading

- [WatermelonDB Schema Documentation](https://nozbe.github.io/WatermelonDB/Schema.html)
- [Supabase Type Generation](https://supabase.com/docs/reference/javascript/installing#generating-types)
- Type Synchronization Guide: `scripts/README-TYPE-SCRIPTS.md`
