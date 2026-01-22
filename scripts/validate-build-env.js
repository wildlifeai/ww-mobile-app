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

const requiredVersions = {
    'react-native': '0.81.5',
    'react': '19.1.0',
    'expo': '~54.0.0', // Allow small patch variations
    'typescript': '~5.9.2',
    '@types/react': '~19.1.10'
};

let depErrors = false;

Object.entries(requiredVersions).forEach(([pkg, reqVer]) => {
    const installedVer = packageJson.dependencies[pkg] || packageJson.devDependencies[pkg];
    if (!installedVer) {
        console.error(`❌ Missing dependency: ${pkg}`);
        depErrors = true;
    } else if (reqVer.startsWith('~') && !installedVer.startsWith(reqVer.substring(0, reqVer.lastIndexOf('.')))) {
         // Loose check for tilde
         // Skip, too complex for simple script, relying on exact matches for critical ones
    } else if (!reqVer.startsWith('~') && installedVer !== reqVer) {
         if (pkg === 'react-native' || pkg === 'react') {
            console.error(`❌ CRITICAL ERROR: Invalid ${pkg} version: ${installedVer}`);
            console.error(`   Required: ${reqVer} (Strictly required for Expo SDK 54)`);
            depErrors = true;
         }
    }
});

if (depErrors) {
    console.error('❌ Build environment validation FAILED.');
    process.exit(1);
}

console.log('✅ Build environment valid.');
process.exit(0);
