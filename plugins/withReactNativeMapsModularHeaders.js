const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix react-native-maps non-modular header errors
 * when using static frameworks on iOS with the New Architecture.
 * 
 * This applies ONLY to react-native-maps and related targets to avoid
 * suppressing legitimate warnings in other dependencies.
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
        console.warn('[withReactNativeMapsModularHeaders] Podfile not found, skipping');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if we've already added the fix (idempotent)
      if (podfileContent.includes('# Fix react-native-maps modular headers')) {
        console.log('[withReactNativeMapsModularHeaders] Already applied, skipping');
        return config;
      }

      // Targeted fix: only modify react-native-maps and GoogleMaps-related pods
      // This is safer than applying to ALL targets
      const fixCode = `    # Fix react-native-maps modular headers with static frameworks
    # Only applies to react-native-maps targets to avoid suppressing other warnings
    installer.pods_project.targets.each do |target|
      # Target specific pods that have modular header issues
      if target.name.include?('react-native-maps') || 
         target.name.include?('react-native-google-maps') ||
         target.name.include?('Google-Maps-iOS-Utils') ||
         target.name.include?('GoogleMaps')
        
        target.build_configurations.each do |config|
          # Allow non-modular includes in framework modules (the core fix)
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          
          # Suppress the specific warnings that cause build failures
          config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
          
          # Optional: suppress all warnings for these specific problematic pods
          # (Uncomment if the above flags aren't enough)
          # config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end
      end
    end
`;

      // More robust regex that handles various formatting styles
      // Matches: post_install do |installer| ... end
      // Captures everything up to (but not including) the closing 'end'
      const postInstallRegex = /(post_install\s+do\s+\|[^|]+\|)([\s\S]*?)(^\s*end\s*$)/m;

      if (postInstallRegex.test(podfileContent)) {
        // Insert our code before the closing 'end' of the post_install block
        podfileContent = podfileContent.replace(postInstallRegex, (match, opening, body, closing) => {
          return `${opening}${body}\n${fixCode}\n${closing}`;
        });

        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('✅ [withReactNativeMapsModularHeaders] Added targeted fix for react-native-maps');
        console.log('   - Applied CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES to maps-related pods only');
      } else {
        // Fallback: If no post_install exists, create one
        // This should be rare in Expo projects
        const newPostInstall = `\npost_install do |installer|\n${fixCode}\nend\n`;

        // Add before the final 'end' of the Podfile
        podfileContent = podfileContent.replace(/^end\s*$/m, `${newPostInstall}end`);

        fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
        console.log('✅ [withReactNativeMapsModularHeaders] Created new post_install hook with react-native-maps fix');
      }

      return config;
    },
  ]);
}

module.exports = withReactNativeMapsModularHeaders;
