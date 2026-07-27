#!/usr/bin/env node
/**
 * Verifies the app version is consistent across every file that carries it.
 *
 * `android/` is tracked in git, so EAS Build reads versionCode/versionName from
 * the native files and ignores app.config.ts. When the two drift, the store
 * gets a build numbered differently from what the release process intended.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const grab = (file, re) => (read(file).match(re) || [])[1];

const version = require('../package.json').version;         // e.g. 0.0.62
const code = String(Number(version.split('.').pop()));      // patch → versionCode

const found = {
	'app.config.ts → android.versionCode': grab('app.config.ts', /versionCode:\s*(\d+)/),
	'app.config.ts → ios.buildNumber': grab('app.config.ts', /buildNumber:\s*"(\d+)"/),
	'android/app/build.gradle → versionCode': grab('android/app/build.gradle', /versionCode\s+(\d+)/),
	'android/app/build.gradle → versionName': grab('android/app/build.gradle', /versionName\s+"([^"]+)"/),
	'strings.xml → expo_runtime_version': grab(
		'android/app/src/main/res/values/strings.xml',
		/name="expo_runtime_version">([^<]+)</,
	),
};

const expected = {
	'app.config.ts → android.versionCode': code,
	'app.config.ts → ios.buildNumber': code,
	'android/app/build.gradle → versionCode': code,
	'android/app/build.gradle → versionName': version,
	'strings.xml → expo_runtime_version': version,
};

console.log(`\n📦 package.json version: ${version}  (expected versionCode: ${code})\n`);

const mismatches = Object.entries(expected).filter(([k, want]) => found[k] !== want);

Object.entries(expected).forEach(([k, want]) => {
	const got = found[k];
	console.log(`  ${got === want ? '✅' : '❌'} ${k}: ${got ?? '(not found)'}${got === want ? '' : `  → expected ${want}`}`);
});

if (mismatches.length === 0) {
	console.log('\n✅ Version is consistent across all files.\n');
	process.exit(0);
}

console.log(`\n❌ ${mismatches.length} mismatch(es). Fix them before tagging a release.`);
console.log('   Release steps: documentation/resources/publishing_guide.md\n');
process.exit(1);
