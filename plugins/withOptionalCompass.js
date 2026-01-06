const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withOptionalCompass(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Ensure 'uses-feature' list exists
        if (!androidManifest.manifest['uses-feature']) {
            androidManifest.manifest['uses-feature'] = [];
        }

        // Add the compass feature as optional
        const hasCompass = androidManifest.manifest['uses-feature'].some(
            (feature) => feature.$['android:name'] === 'android.hardware.location.compass'
        );

        if (!hasCompass) {
            androidManifest.manifest['uses-feature'].push({
                $: {
                    'android:name': 'android.hardware.location.compass',
                    'android:required': 'false',
                },
            });
        }

        return config;
    });
};
