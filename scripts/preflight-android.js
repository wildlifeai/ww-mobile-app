#!/usr/bin/env node
/**
 * Preflight for local Android device runs.
 *
 * `npm run android` starts a multi-minute Gradle build. Each check below
 * otherwise fails silently or cryptically minutes in, so we check up front
 * and print the fix.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILES = ['.env.development', '.env.local', '.env'];

// `2>&1` because the tools disagree about which stream to use: `java -version`
// writes to stderr, `adb devices` to stdout. Merge them and read whatever comes.
const sh = (cmd) => {
	try {
		return execSync(`${cmd} 2>&1`, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim();
	} catch {
		return null;
	}
};

// Each check returns null when it passes, or [problem, fix] when it does not.
const checks = {
	'Node >= 20': () =>
		Number(process.versions.node.split('.')[0]) >= 20
			? null
			: [`Node ${process.versions.node}`, 'nvm install 20 && nvm use 20'],

	'Dependencies installed': () =>
		fs.existsSync(path.join(ROOT, 'node_modules'))
			? null
			: ['node_modules missing', 'npm install   (not --ignore-scripts: that skips patch-package)'],

	'JDK 17': () => {
		const out = sh('java -version');
		if (!out) return ['java not on PATH', 'Install a JDK 17 (Temurin/Zulu) and set JAVA_HOME'];
		// e.g. openjdk version "17.0.20" 2026-07-21
		const major = Number((out.match(/version "(\d+)/) || [])[1]);
		if (!major) return ['could not parse the java version', `got: ${out.split('\n')[0]}`];
		return major === 17
			? null
			: [`JDK ${major} found`, 'Android requires JDK 17 — 21+ gives "Unsupported class file major version"'];
	},

	'Android SDK': () => {
		const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
		return sdk && fs.existsSync(sdk)
			? null
			: ['ANDROID_HOME/ANDROID_SDK_ROOT unset', 'Point it at your SDK (Windows: %LOCALAPPDATA%\\Android\\Sdk)'];
	},

	'USB device': () => {
		const out = sh('adb devices');
		if (out === null) return ['adb not on PATH', 'Add <SDK>/platform-tools to PATH'];
		const lines = out.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
		if (lines.some((l) => /\bdevice$/.test(l))) return null;
		if (lines.some((l) => /unauthorized/.test(l)))
			return ['Device unauthorised', 'Unlock the phone and accept "Allow USB debugging"'];
		return ['No device detected', 'Enable USB debugging, plug in, then: adb devices'];
	},

	'Supabase env': () => {
		const file = ENV_FILES.find((f) => fs.existsSync(path.join(ROOT, f)));
		if (!file) return [`none of ${ENV_FILES.join(', ')}`, 'cp .env.example .env.development, then paste the Dev anon key'];
		const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
		const key = (body.match(/^[ \t]*EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m) || [])[1] || '';
		if (!/^[ \t]*EXPO_PUBLIC_SUPABASE_URL=https:\/\/[a-z0-9]+\.supabase\.co/m.test(body))
			return [`${file}: SUPABASE_URL missing/malformed`, 'See .env.example'];
		if (!key.trim() || /^<.*>$/.test(key.trim()))
			return [`${file}: anon key is still a placeholder`, 'Paste the real Dev anon key — login and sync fail without it'];
		return null;
	},
};

console.log('\n🔍 Android preflight\n');

const blockers = Object.entries(checks).flatMap(([name, check]) => {
	const failure = check();
	console.log(failure ? `  ❌ ${name}: ${failure[0]}` : `  ✅ ${name}`);
	return failure ? [[name, failure[1]]] : [];
});

if (blockers.length === 0) {
	console.log('\n✅ Ready — starting the build.\n');
	process.exit(0);
}

console.log(`\n❌ Fix ${blockers.length} blocker(s) first:\n`);
blockers.forEach(([name, fix], i) => console.log(`  ${i + 1}. ${name} → ${fix}`));
console.log('\nSetup guide: documentation/resources/Android-Guide.md\n');
process.exit(1);
