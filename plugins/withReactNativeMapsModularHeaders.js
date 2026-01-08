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
    puts "🔧 [Podfile] Applying modular headers fix for static frameworks..."
    
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Core fix: Allow non-modular includes in all framework modules
        # This is required because React Native headers are not fully modular
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # Disable the warning that causes build failures
        config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        
        # Suppress documentation warnings that can cause issues
        config.build_settings['CLANG_WARN_DOCUMENTATION_COMMENTS'] = 'NO'
        
        # For particularly problematic pods, suppress ALL warnings
        if target.name.include?('react-native-maps') || 
           target.name.include?('react-native-google-maps') ||
           target.name.include?('Google-Maps')
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end
      end
    end
    
    puts "✅ [Podfile] Applied modular headers fix to #{installer.pods_project.targets.count} targets"
`;

      // More robust regex that handles various Podfile formats
      const postInstallRegex = /(post_install\s+do\s+\|[^|]+\|)([\s\S]*?)(^\s*end\s*$)/m;
      
      if (postInstallRegex.test(podfileContent)) {
        podfileContent = podfileContent.replace(postInstallRegex, (match, opening, body, closing) => {
          return `${opening}${body}${fixCode}\n${closing}`;
        });
        
        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('[withReactNativeMapsModularHeaders] ✅ Successfully injected fix into existing post_install hook');
      } else {
        // Fallback: Create new post_install hook
        const newPostInstall = `\npost_install do |installer|${fixCode}\nend\n`;
        podfileContent = podfileContent.replace(/^end\s*$/m, `${newPostInstall}end`);
        
        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('[withReactNativeMapsModularHeaders] ✅ Created new post_install hook with modular headers fix');
      }

      console.log('[withReactNativeMapsModularHeaders] 🎉 Podfile modifications complete');
      return config;
    },
  ]);
}

module.exports = withReactNativeMapsModularHeaders;
