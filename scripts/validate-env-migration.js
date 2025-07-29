#!/usr/bin/env node

/**
 * Validation script for environment variable migration from react-native-config to expo-constants
 * Part of Task 4.2: Execute Environment Variable Migration Script
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Environment Variable Migration...\n');

let hasErrors = false;
let filesChecked = 0;
let rnConfigImports = [];
let configUsageFound = [];
let expoConstantsUsage = [];

// Patterns to check
const oldPatterns = [
  "import.*from.*['\"]react-native-config['\"]",
  "require\\(['\"]react-native-config['\"]\\)"
];

const configUsagePatterns = [
  'Config\\.',
  'Constants\\.expoConfig\\.extra\\.'
];

// Find all JS/TS files
function findFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
        findFiles(filePath, fileList);
      } else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
        fileList.push(filePath);
      }
    });
  } catch (error) {
    // Ignore directories we can't read
  }
  return fileList;
}

// Check files for patterns
const srcFiles = findFiles('./src');
const componentFiles = findFiles('./components');
const allFiles = [...srcFiles, ...componentFiles];

console.log(`Checking ${allFiles.length} files...\n`);

allFiles.forEach(file => {
  filesChecked++;
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for old react-native-config imports
  oldPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'g');
    if (regex.test(content)) {
      rnConfigImports.push({ file, pattern });
      hasErrors = true;
    }
  });
  
  // Check for Config usage (should be from utils/environment now)
  if (content.includes('Config.')) {
    configUsageFound.push(file);
    
    // Check if it's importing from the right place
    if (content.includes("from '../../utils/environment'") || 
        content.includes('from "../utils/environment"') ||
        content.includes('from "./utils/environment"') ||
        content.includes('from "utils/environment"') ||
        content.includes("from './environment'") ||
        content.includes("from '../environment'")) {
      // Good - using the compatibility layer
    } else if (!file.includes('__tests__')) {
      console.warn(`⚠️  ${file} uses Config but import source unclear`);
    }
  }
  
  // Check for direct Constants.expoConfig usage
  if (content.includes('Constants.expoConfig')) {
    expoConstantsUsage.push(file);
  }
});

// Report results
console.log('📊 Environment Variable Migration Results:\n');
console.log(`✓ Files checked: ${filesChecked}`);
console.log(`✓ react-native-config imports found: ${rnConfigImports.length}`);
console.log(`✓ Config usage found: ${configUsageFound.length} files`);
console.log(`✓ Direct expo-constants usage: ${expoConstantsUsage.length} files\n`);

if (rnConfigImports.length > 0) {
  console.log('❌ MIGRATION INCOMPLETE - Found react-native-config imports:\n');
  rnConfigImports.forEach(({ file, pattern }) => {
    console.log(`  - ${file}`);
  });
  console.log('\n');
} else {
  console.log('✅ Environment Variable Migration COMPLETE - No react-native-config imports found!\n');
}

if (configUsageFound.length > 0) {
  console.log('📁 Files using Config (via compatibility layer):\n');
  configUsageFound.forEach(file => {
    console.log(`  - ${file}`);
  });
  console.log('\n');
}

// Check app.config.js for proper extra field setup
console.log('🔍 Checking app.config.js configuration:\n');

try {
  const appConfigPath = './app.config.js';
  if (fs.existsSync(appConfigPath)) {
    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    
    if (appConfigContent.includes('extra:')) {
      console.log('  ✅ app.config.js has extra field configured');
      
      // Check for specific env vars
      const expectedVars = ['apiBase', 'googleMapsApiKeyAndroid', 'googleMapsApiKeyIos'];
      expectedVars.forEach(varName => {
        if (appConfigContent.includes(varName)) {
          console.log(`  ✅ ${varName} is configured in extra field`);
        } else {
          console.log(`  ⚠️  ${varName} might be missing from extra field`);
        }
      });
    } else {
      console.log('  ❌ app.config.js missing extra field for environment variables');
      hasErrors = true;
    }
  } else {
    console.log('  ⚠️  app.config.js not found');
  }
} catch (error) {
  console.log('  ❌ Error reading app.config.js:', error.message);
}

// Check environment utility file
console.log('\n🔍 Checking environment utility:\n');

const envUtilPath = './src/utils/environment.ts';
if (fs.existsSync(envUtilPath)) {
  console.log('  ✅ Environment utility exists at src/utils/environment.ts');
  
  const envContent = fs.readFileSync(envUtilPath, 'utf8');
  if (envContent.includes('expo-constants')) {
    console.log('  ✅ Uses expo-constants');
  }
  if (envContent.includes('class EnvironmentConfig')) {
    console.log('  ✅ Provides EnvironmentConfig compatibility layer');
  }
  if (envContent.includes('export const Config')) {
    console.log('  ✅ Exports Config for backward compatibility');
  }
} else {
  console.log('  ❌ Environment utility not found at expected location');
  hasErrors = true;
}

console.log('\n📋 Summary:');
console.log('━'.repeat(50));
console.log(`Migration Status: ${hasErrors ? '❌ INCOMPLETE' : '✅ COMPLETE'}`);
console.log(`Files using Config: ${configUsageFound.length}`);
console.log(`Direct react-native-config imports: ${rnConfigImports.length}`);
console.log(`Environment utility: ${fs.existsSync(envUtilPath) ? '✅ Present' : '❌ Missing'}`);
console.log('━'.repeat(50));

process.exit(hasErrors ? 1 : 0);