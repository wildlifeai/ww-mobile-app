#!/usr/bin/env node
/**
 * Is supabase/schemas still what ww-backend has? `sync-db-schema.js` copies the
 * backend's declarative schema into this repo and nothing checked the copy
 * stayed current; in October 2026 six files differed and one was missing.
 *
 * Compares every folder in SCHEMA_MAP against a checkout of ww-backend and
 * reports files that differ, files the backend has and the mirror lacks, and
 * files the mirror has that the backend dropped (PRESERVE_FILES excepted).
 * Exit 1 on any drift, 2 on a missing backend folder.
 *
 *   node scripts/check-schema-mirror.js <path-to-ww-backend-checkout>
 *
 * CI runs it from schema-mirror-drift.yml against ww-backend's dev. The fix for
 * drift is `npm run db:sync-schema`, then commit.
 */
const fs = require('fs');
const path = require('path');
const { SCHEMA_MAP, PRESERVE_FILES } = require('./schema-sync-config');

const backend = process.argv[2];
if (!backend || !fs.existsSync(path.join(backend, 'supabase'))) {
	console.error('usage: node scripts/check-schema-mirror.js <path-to-ww-backend-checkout>');
	process.exit(2);
}
const mobile = path.resolve(__dirname, '../supabase');

const listSql = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : null);

const differ = [];
const missing = [];
const extra = [];
let missingDirs = 0;

for (const schemaPath of SCHEMA_MAP) {
	const src = path.join(backend, 'supabase', schemaPath);
	const dest = path.join(mobile, schemaPath);
	const srcFiles = listSql(src);
	if (srcFiles === null) {
		console.error(`backend has no ${schemaPath}: the folder list in scripts/schema-sync-config.js is out of date`);
		missingDirs += 1;
		continue;
	}
	const destFiles = listSql(dest) ?? [];
	for (const f of srcFiles) {
		const rel = `${schemaPath}/${f}`;
		if (!destFiles.includes(f)) { missing.push(rel); continue; }
		if (!fs.readFileSync(path.join(src, f)).equals(fs.readFileSync(path.join(dest, f)))) differ.push(rel);
	}
	for (const f of destFiles) {
		if (!srcFiles.includes(f) && !PRESERVE_FILES.includes(f)) extra.push(`${schemaPath}/${f}`);
	}
}

const report = (title, items) => {
	if (items.length === 0) return;
	console.log(`${title} (${items.length}):`);
	for (const i of items) console.log(`  ${i}`);
};
report('Files that differ from the backend', differ);
report('Files the backend has and the mirror lacks', missing);
report('Files the mirror has that the backend dropped', extra);

if (missingDirs > 0) process.exit(2);
if (differ.length + missing.length + extra.length > 0) {
	console.log('\nThe mirror has drifted: run `npm run db:sync-schema` and commit the result.');
	process.exit(1);
}
console.log(`supabase/schemas matches ww-backend across ${SCHEMA_MAP.length} folders.`);
