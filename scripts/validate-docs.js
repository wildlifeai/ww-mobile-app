#!/usr/bin/env node
/**
 * Catches documentation drift: source paths and doc links that no longer exist.
 *
 * A 2026-07-27 audit of documentation/ found ~40 wrong claims; roughly 30 were
 * dead file paths — mechanically checkable, so we check them.
 *
 * Usage: npm run docs:validate
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'documentation');

// Paths named in prose that point at the repo. Tree diagrams and globs are
// skipped — they describe shape, not specific files.
const CODE_PATH = /`((?:src|scripts|tests|android|plugins|supabase)\/[A-Za-z0-9._/-]+)`/g;
const MD_LINK = /\[[^\]]*\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g;

// Gitignored files the docs legitimately tell you to create yourself.
const EXPECTED_ABSENT = new Set(['android/local.properties']);

// decodeURIComponent throws on a stray '%' — a link containing "100%" must not
// take down the whole run.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		return e.isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
	});

const problems = [];

for (const file of walk(DOCS)) {
	const rel = path.relative(ROOT, file).replace(/\\/g, '/');
	const body = fs.readFileSync(file, 'utf8');
	const lineOf = (index) => body.slice(0, index).split('\n').length;

	for (const m of body.matchAll(CODE_PATH)) {
		const target = m[1];
		if (target.includes('*') || target.endsWith('/') || EXPECTED_ABSENT.has(target)) continue;
		if (!fs.existsSync(path.join(ROOT, target))) {
			problems.push([rel, lineOf(m.index), `missing path: ${target}`]);
		}
	}

	for (const m of body.matchAll(MD_LINK)) {
		const target = m[1];
		if (/^(https?:|mailto:)/.test(target)) continue;
		const resolved = path.resolve(path.dirname(file), decode(target));
		if (!fs.existsSync(resolved)) {
			problems.push([rel, lineOf(m.index), `broken link: ${target}`]);
		}
	}
}

console.log(`\n📚 Checked ${walk(DOCS).length} markdown files under documentation/\n`);

if (problems.length === 0) {
	console.log('✅ All referenced paths and links resolve.\n');
	process.exit(0);
}

for (const [file, line, message] of problems) {
	console.log(`  ❌ ${file}:${line} — ${message}`);
}
console.log(`\n❌ ${problems.length} documentation reference(s) do not resolve.\n`);
process.exit(1);
