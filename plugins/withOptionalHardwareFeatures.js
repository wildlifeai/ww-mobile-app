const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to mark hardware features as optional in AndroidManifest.xml.
 * This prevents Google Play from filtering out devices that lack specific sensors
 * (e.g., compass, gyroscope, camera) while still allowing the app to function.
 * 
 * @param {ExpoConfig} config - The Expo config object
 * @returns {ExpoConfig} Modified config with optional hardware features
 */
module.exports = function withOptionalHardwareFeatures(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Validate manifest structure
        if (!androidManifest || !androidManifest.manifest) {
            console.warn('[withOptionalHardwareFeatures] Invalid AndroidManifest structure, skipping');
            return config;
        }

        // Ensure 'uses-feature' list exists
        if (!androidManifest.manifest['uses-feature']) {
            androidManifest.manifest['uses-feature'] = [];
        }

        // Hardware features that should be optional (not required)
        // This allows installation on budget devices that may lack these sensors
        const optionalFeatures = [
            // Location & Navigation
            'android.hardware.location.gps',
            'android.hardware.location.compass',
            'android.hardware.location.network',

            // Connectivity
            'android.hardware.bluetooth',
            'android.hardware.bluetooth_le',
            'android.hardware.telephony',
            'android.hardware.wifi',

            // Camera
            'android.hardware.camera',
            'android.hardware.camera.autofocus',
            'android.hardware.camera.flash',

            // Sensors (often missing on budget devices)
            'android.hardware.sensor.accelerometer',
            'android.hardware.sensor.gyroscope',
            'android.hardware.sensor.barometer',
            'android.hardware.sensor.compass', // Alias for magnetometer
        ];

        const modifiedFeatures = [];

        optionalFeatures.forEach(featureName => {
            const existingFeature = androidManifest.manifest['uses-feature'].find(
                (feature) => feature.$ && feature.$['android:name'] === featureName
            );

            if (existingFeature) {
                // Feature already declared - check if it's marked as required
                const isRequired = existingFeature.$['android:required'] === 'true';

                if (isRequired) {
                    // Change from required to optional
                    existingFeature.$['android:required'] = 'false';
                    modifiedFeatures.push(`${featureName} (changed from required to optional)`);
                }
                // If already optional, do nothing
            } else {
                // Feature not declared - add as optional to prevent implicit requirements
                androidManifest.manifest['uses-feature'].push({
                    $: {
                        'android:name': featureName,
                        'android:required': 'false',
                    },
                });
                modifiedFeatures.push(`${featureName} (added as optional)`);
            }
        });

        // Log summary
        if (modifiedFeatures.length > 0) {
            console.log(`[withOptionalHardwareFeatures] Modified ${modifiedFeatures.length} hardware features:`);
            modifiedFeatures.forEach(feature => console.log(`  - ${feature}`));
        } else {
            console.log('[withOptionalHardwareFeatures] All hardware features already properly configured');
        }

        return config;
    });
};
