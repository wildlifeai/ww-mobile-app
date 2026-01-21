const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix react-native-maps non-modular header errors
 * when using static frameworks on iOS with the New Architecture.
 * 
 * NOTE: This applies modular header fixes to ALL pods because react-native-maps
 * has deep transitive dependencies with React Core that cause cascading errors.
 * A targeted approach doesn't work due to how static frameworks resolve headers.
 * 
 * @param {ExpoConfig} config - The Expo config object
 * @returns {ExpoConfig} Modified config with Podfile post_install hook
 */
function withReactNativeMapsModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      
      if (!fs.existsSync(podfilePath)) {
        console.warn('[withReactNativeMapsModularHeaders] ⚠️  Podfile not found at:', podfilePath);
        return config;
      }

      console.log('[withReactNativeMapsModularHeaders] 📝 Reading Podfile from:', podfilePath);
      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if we've already added the fix (idempotent)
      if (podfileContent.includes('# MODULAR_HEADERS_FIX_APPLIED')) {
        console.log('[withReactNativeMapsModularHeaders] ✅ Fix already applied, skipping');
        return config;
      }

      // Comprehensive fix for static frameworks + New Architecture
      // Must apply to ALL targets due to transitive header dependencies
      const fixCode = `
    # MODULAR_HEADERS_FIX_APPLIED
    # Fix for react-native-maps and static frameworks with New Architecture
    # This MUST apply to all targets due to transitive React Core dependencies
    puts "[Podfile] Applying modular headers fix for static frameworks..."
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Core fix: Allow non-modular includes in all framework modules
        # This is required because React Native headers are not fully modular
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # Disable the warning that causes build failures
        config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        
        # Suppress documentation warnings that can cause issues
        config.build_settings['CLANG_WARN_DOCUMENTATION_COMMENTS'] = 'NO'
        
        
        # Suppress warnings for all map-related pods
        if target.name.include?('react-native-maps') || 
           target.name.include?('react-native-google-maps') ||
           target.name.include?('Google-Maps')
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end

        # Disable modules ONLY for the RN wrappers to fix the RCTViewManager import issue
        # We MUST exclude Google-Maps-iOS-Utils because it is Swift and needs modules!
        if (target.name.include?('react-native-maps') || target.name.include?('react-native-google-maps')) && !target.name.include?('Utils')
           config.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end
    end
    
    puts "✅ [Podfile] Applied modular headers fix to #{installer.pods_project.targets.count} targets"
`;
      
      // Strategy: Insert at the BEGINNING of post_install block
      // This is the safest approach to avoid syntax errors with matching parentheses of other calls.
      // Although running after standard setup is ideal, running before is usually sufficient for Pod target settings.
      if (podfileContent.includes('post_install do')) {
        console.log('[withReactNativeMapsModularHeaders] 🔍 Found post_install block');
        podfileContent = podfileContent.replace(
          /(post_install\s+do\s+\|.*?\|)/,
          `$1${fixCode}`
        );
        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('[withReactNativeMapsModularHeaders] ✅ Injected fix at start of post_install block');
      }
      // Strategy 2: If no post_install block found, append new one.
      else {
        console.log('[withReactNativeMapsModularHeaders] ⚠️ No post_install block found. Appending new one.');
        const newPostInstall = `\npost_install do |installer|${fixCode}end\n`;
        podfileContent += newPostInstall;
        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('[withReactNativeMapsModularHeaders] ✅ Appended new post_install hook');
      }

      console.log('[withReactNativeMapsModularHeaders] 🎉 Podfile modifications complete');
      return config;
    },
  ]);
}

module.exports = withReactNativeMapsModularHeaders;
