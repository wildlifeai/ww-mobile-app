#!/usr/bin/env node

/**
 * Dependency Validation Script v2 - Configurable Version
 * 
 * Uses dependency-rules.json for flexible validation configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

class ConfigurableDependencyValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    
    // Load configuration
    const configPath = path.join(__dirname, 'dependency-rules.json');
    if (!fs.existsSync(configPath)) {
      console.error('❌ dependency-rules.json not found');
      console.error('Please create it using the template in the documentation');
      process.exit(1);
    }
    
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Load package.json
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(this.packageJsonPath)) {
      console.error('❌ package.json not found');
      process.exit(1);
    }
    
    this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
  }

  run() {
    console.log('🔍 Wildlife Watcher Dependency Validation v2\n');
    console.log(`📋 Using rules from: ${this.config.description}\n`);
    
    const settings = this.config.validationSettings || {};
    
    // Run validations based on settings
    this.validateRules();
    
    if (settings.checkOverrides !== false) {
      this.validateOverrides();
    }
    
    if (settings.checkDuplicates !== false) {
      this.validateNoConflictingVersions();
    }
    
    if (settings.runExpoDoctor !== false) {
      this.runExpoDoctor();
    }
    
    return this.generateReport(settings);
  }

  validateRules() {
    console.log('📦 Validating package versions...\n');
    
    Object.entries(this.config.rules || {}).forEach(([pkg, rule]) => {
      const installed = this.getInstalledVersion(pkg);
      
      // Check if package is installed
      if (!installed) {
        if (rule.optional) {
          this.addMessage(rule.severity || 'info', 
            `${pkg} not yet installed (requires ${rule.required})`);
        } else {
          this.addMessage(rule.severity || 'error',
            `${pkg} is missing (requires ${rule.required})`);
        }
        return;
      }
      
      // If 'installed' field matches actual, it's an acknowledged deviation
      if (rule.installed && installed === rule.installed) {
        console.log(`ℹ️  ${pkg}@${installed} - known deviation from ${rule.required}`);
        if (rule.reason) {
          console.log(`   Reason: ${rule.reason}`);
        }
        return;
      }
      
      // Check version match
      const versionToCheck = rule.allowedRange || rule.required;
      const matches = this.versionSatisfies(installed, versionToCheck);
      
      if (!matches) {
        const message = `${pkg}@${installed} doesn't satisfy ${versionToCheck}`;
        const fix = `Run 'npm install ${pkg}@${rule.required}'`;
        
        this.addMessage(rule.severity || 'error', message, fix, rule.reason);
      } else {
        console.log(`✅ ${pkg}@${installed} satisfies ${versionToCheck}`);
        if (rule.reason && rule.severity === 'warning') {
          console.log(`   Note: ${rule.reason}`);
        }
      }
    });
    
    console.log('');
  }

  validateOverrides() {
    console.log('🔒 Validating package overrides...\n');
    
    const overrides = this.packageJson.overrides || {};
    const requiredOverrides = this.config.overrideRequirements || {};
    
    Object.entries(requiredOverrides).forEach(([pkg, version]) => {
      if (!overrides[pkg]) {
        this.errors.push(`❌ Missing required override for ${pkg}`);
      } else if (overrides[pkg] !== version) {
        this.errors.push(
          `❌ ${pkg} override is ${overrides[pkg]} but should be ${version}`
        );
      }
      
      // Check override matches direct dependency
      const directVersion = this.packageJson.dependencies?.[pkg];
      if (directVersion && overrides[pkg] && directVersion !== overrides[pkg]) {
        this.errors.push(
          `❌ ${pkg} version mismatch:\n` +
          `   dependencies: ${directVersion}\n` +
          `   overrides: ${overrides[pkg]}`
        );
      }
    });
    
    console.log('');
  }

  validateNoConflictingVersions() {
    console.log('🔄 Checking for version conflicts...\n');
    
    const deps = Object.keys(this.packageJson.dependencies || {});
    const devDeps = Object.keys(this.packageJson.devDependencies || {});
    
    const duplicates = deps.filter(dep => devDeps.includes(dep));
    
    duplicates.forEach(pkg => {
      const depVersion = this.packageJson.dependencies[pkg];
      const devDepVersion = this.packageJson.devDependencies[pkg];
      
      if (depVersion !== devDepVersion) {
        this.errors.push(
          `❌ ${pkg} has conflicting versions:\n` +
          `   dependencies: ${depVersion}\n` +
          `   devDependencies: ${devDepVersion}\n` +
          `   Fix: Remove from devDependencies`
        );
      }
    });
    
    console.log('');
  }

  runExpoDoctor() {
    console.log('🏥 Running expo-doctor checks...\n');
    
    try {
      execSync('npx expo-doctor --fix-dependencies', { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log('✅ expo-doctor passed all checks');
    } catch (error) {
      const output = error.stdout || '';
      
      // Check against known/accepted warnings
      const sdkCompat = this.config.sdkCompatibility?.['51'] || {};
      let hasUnexpectedWarnings = false;
      
      Object.entries(sdkCompat).forEach(([pkg, expectedVersion]) => {
        const rule = this.config.rules[pkg];
        if (rule?.installed) {
          // This is a known deviation, don't warn
          return;
        }
        
        const installed = this.getInstalledVersion(pkg);
        if (installed && !this.versionSatisfies(installed, expectedVersion)) {
          if (!output.includes(`${pkg}@${installed}`)) {
            hasUnexpectedWarnings = true;
          }
        }
      });
      
      if (hasUnexpectedWarnings) {
        this.warnings.push('⚠️  expo-doctor reported unexpected issues - run "npx expo-doctor" to see details');
      } else {
        console.log('ℹ️  expo-doctor reported expected warnings (known deviations)');
      }
    }
    
    console.log('');
  }

  versionSatisfies(installed, requirement) {
    // Handle exact match first
    if (installed === requirement) return true;
    
    // Clean up versions for semver
    const cleanInstalled = installed.replace(/^[~^]/, '');
    const cleanRequirement = requirement.replace(/^[~^]/, '');
    
    // If installed has a range prefix, extract the version
    let installedVersion = cleanInstalled;
    if (installed.startsWith('~') || installed.startsWith('^')) {
      installedVersion = cleanInstalled;
    }
    
    // Try semver satisfaction
    try {
      // First try: direct satisfaction check
      if (semver.satisfies(installedVersion, requirement)) {
        return true;
      }
      
      // Second try: if both have same prefix, compare base versions
      if (installed.startsWith('~') && requirement.startsWith('~')) {
        return semver.satisfies(installedVersion, `~${cleanRequirement}`);
      }
      
      if (installed.startsWith('^') && requirement.startsWith('^')) {
        return semver.satisfies(installedVersion, `^${cleanRequirement}`);
      }
      
      // Special case for tilde ranges in package.json
      if (installed === `~${cleanRequirement}`) {
        return true;
      }
      
    } catch (e) {
      // Fallback to string comparison if semver fails
      console.debug(`Semver parse failed for ${installed} vs ${requirement}, using string match`);
    }
    
    return false;
  }

  getInstalledVersion(pkg) {
    return this.packageJson.dependencies?.[pkg] || 
           this.packageJson.devDependencies?.[pkg] || 
           null;
  }

  addMessage(severity, message, fix, reason) {
    const fullMessage = {
      text: message,
      fix: fix,
      reason: reason
    };
    
    switch(severity) {
      case 'error':
        this.errors.push(fullMessage);
        break;
      case 'warning':
        this.warnings.push(fullMessage);
        break;
      case 'info':
        this.info.push(fullMessage);
        break;
      default:
        this.warnings.push(fullMessage);
    }
  }

  generateReport(settings) {
    console.log('📊 Validation Report');
    console.log('===================\n');
    
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;
    const hasInfo = this.info.length > 0;
    
    if (!hasErrors && !hasWarnings && !hasInfo) {
      console.log('✅ All dependency checks passed!\n');
      return true;
    }
    
    // Show messages by severity
    if (hasErrors) {
      console.log('❌ ERRORS (must fix):\n');
      this.errors.forEach(error => {
        if (typeof error === 'string') {
          console.log(error);
        } else {
          console.log(`❌ ${error.text}`);
          if (error.fix) console.log(`   Fix: ${error.fix}`);
          if (error.reason) console.log(`   Reason: ${error.reason}`);
        }
        console.log('');
      });
    }
    
    if (hasWarnings) {
      console.log('⚠️  WARNINGS (review):\n');
      this.warnings.forEach(warning => {
        if (typeof warning === 'string') {
          console.log(warning);
        } else {
          console.log(`⚠️  ${warning.text}`);
          if (warning.fix) console.log(`   Fix: ${warning.fix}`);
          if (warning.reason) console.log(`   Reason: ${warning.reason}`);
        }
        console.log('');
      });
    }
    
    if (hasInfo) {
      console.log('ℹ️  INFO (awareness):\n');
      this.info.forEach(info => {
        if (typeof info === 'string') {
          console.log(info);
        } else {
          console.log(`ℹ️  ${info.text}`);
          if (info.reason) console.log(`   Reason: ${info.reason}`);
        }
        console.log('');
      });
    }
    
    // Determine exit code based on settings
    const blockOnError = settings.blockOnError !== false;
    const blockOnWarning = settings.blockOnWarning === true;
    
    if (hasErrors && blockOnError) {
      console.log('❌ Validation failed due to errors!\n');
      return false;
    }
    
    if (hasWarnings && blockOnWarning) {
      console.log('❌ Validation failed due to warnings (strict mode)!\n');
      return false;
    }
    
    console.log('✅ Validation passed with notes.\n');
    return true;
  }
}

// Check if semver is available, install if not
try {
  require('semver');
} catch (e) {
  console.log('📦 Installing semver for version comparison...');
  execSync('npm install --no-save semver', { stdio: 'inherit' });
}

// Run validation
if (require.main === module) {
  const validator = new ConfigurableDependencyValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = ConfigurableDependencyValidator;