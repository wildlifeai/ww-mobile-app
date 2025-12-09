const { withAndroidManifest } = require('@expo/config-plugins');

const withDfuService = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const mainApplication = androidManifest.manifest.application[0];

        // Ensure services array exists
        if (!mainApplication.service) {
            mainApplication.service = [];
        }

        // Helper to add or update a service
        const addOrUpdateService = (serviceName) => {
            let service = mainApplication.service.find(
                (s) => s['$']['android:name'] === serviceName
            );

            if (!service) {
                service = {
                    $: {
                        'android:name': serviceName,
                        'android:exported': 'false', // Match library value to avoid merge conflict
                        'android:foregroundServiceType': 'connectedDevice',
                    }
                };
                mainApplication.service.push(service);
            } else {
                service['$']['android:foregroundServiceType'] = 'connectedDevice';
            }
        };

        // Add proper foreground service type for BOTH the base Nordic service AND the Pilloxa wrapper
        // The crash log specifically mentioned 'com.pilloxa.dfu.DfuService'
        addOrUpdateService('no.nordicsemi.android.dfu.DfuBaseService');
        addOrUpdateService('com.pilloxa.dfu.DfuService');

        return config;
    });
};

module.exports = withDfuService;
