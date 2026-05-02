const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Build Environment...');

// 1. Validate Gradle Version
const gradleWrapperPath = path.join(__dirname, '..', 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

if (fs.existsSync(gradleWrapperPath)) {
    const gradleConfig = fs.readFileSync(gradleWrapperPath, 'utf8');
    const match = gradleConfig.match(/distributionUrl=.*gradle-([0-9.]+)-bin\.zip/);
    if (match) {
        const gradleVersion = match[1];
        // Enforce strict Gradle 8.14.3 for Expo SDK 54 compatibility
        if (gradleVersion !== '8.14.3') {
            console.error(`❌ CRITICAL ERROR: Incompatible Gradle version: ${gradleVersion}`);
            console.error(`   Required: 8.14.3 (Strictly required for Expo SDK 54 autolinking compatibility)`);
            console.error(`   Fix: Update android/gradle/wrapper/gradle-wrapper.properties to use gradle-8.14.3-bin.zip`);
            process.exit(1);
        } else {
            console.log('✅ Gradle version 8.14.3 confirmed.');
        }
    } else {
        console.warn('⚠️ Could not parse Gradle version from wrapper properties.');
    }
} else {
    console.warn('⚠️ Gradle wrapper properties not found (skipping Gradle check).');
}

// 2. Validate Key Dependencies
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

// Auto-read critical versions from package.json itself so this never goes stale.
// Only enforce that these keys exist and are non-empty.
const criticalDeps = [
    'react-native',
    'react',
    'expo',
    'typescript',
    '@types/react',
];

let depErrors = false;

criticalDeps.forEach((pkg) => {
    const installedVer = packageJson.dependencies[pkg] || packageJson.devDependencies[pkg];
    if (!installedVer) {
        console.error(`❌ Missing critical dependency: ${pkg}`);
        depErrors = true;
    } else {
        console.log(`  ✅ ${pkg}: ${installedVer}`);
    }
});

if (depErrors) {
    console.error('❌ Build environment validation FAILED.');
    process.exit(1);
}

console.log('✅ Build environment valid.');
process.exit(0);
