#!/usr/bin/env node
/**
 * The em dash rule, as a check (AGENTS.md: "No em dashes in documents or
 * anything else that gets pasted elsewhere. Commas, or a new sentence.").
 *
 * Walks the prose: documentation/, .agents/, AGENTS.md, CLAUDE.md, README.md.
 * Any Markdown file with an em dash (U+2014) fails the check, with its lines.
 *
 *   node scripts/check-em-dashes.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['documentation', '.agents', 'AGENTS.md', 'CLAUDE.md', 'README.md'];
const EM_DASH = '\u2014';

const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
		return p.endsWith('.md') ? [p] : [];
	});

const files = TARGETS.flatMap((t) => {
	const p = path.join(ROOT, t);
	if (!fs.existsSync(p)) return [];
	return fs.statSync(p).isDirectory() ? walk(p) : [p];
});

const failures = [];
for (const file of files) {
	const lines = fs.readFileSync(file, 'utf8').split('\n');
	const hits = lines.map((l, i) => (l.includes(EM_DASH) ? i + 1 : 0)).filter(Boolean);
	if (hits.length === 0) continue;
	const rel = path.relative(ROOT, file).split(path.sep).join('/');
	failures.push(`${rel}: em dash on line${hits.length > 1 ? 's' : ''} ${hits.join(', ')}`);
}

if (failures.length > 0) {
	console.error('Em dashes in prose (AGENTS.md: commas, or a new sentence):');
	for (const f of failures) console.error(`  ${f}`);
	console.error(`\n${failures.length} file(s).`);
	process.exit(1);
}
console.log(`No em dashes in ${files.length} Markdown files.`);
