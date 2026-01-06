const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix react-native-maps non-modular header warnings
 * when using static frameworks on iOS with the New Architecture.
 */
module.exports = function withReactNativeMapsModularHeaders(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

            if (!fs.existsSync(podfilePath)) {
                console.warn('Podfile not found, skipping react-native-maps fix');
                return config;
            }

            let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

            // Check if we've already added the fix
            if (podfileContent.includes('# Fix for react-native-maps modular headers')) {
                return config;
            }

            // Add compiler flags to suppress non-modular header warnings for react-native-maps
            const fixCode = `
  # Fix for react-native-maps modular headers with static frameworks
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      if target.name == 'react-native-google-maps' || target.name.start_with?('react-native-maps')
        target.build_configurations.each do |config|
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
          config.build_settings['CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER'] = 'NO'
        end
      end
    end
  end
`;

            // Insert before the final 'end' statement
            podfileContent = podfileContent.replace(/^end\s*$/m, `${fixCode}\nend`);

            fs.writeFileSync(podfilePath, podfileContent, 'utf-8');
            console.log('✅ Added react-native-maps modular headers fix to Podfile');

            return config;
        },
    ]);
};
