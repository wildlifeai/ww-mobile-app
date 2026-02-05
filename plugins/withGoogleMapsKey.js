const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const withGoogleMapsKey = (config, { iosApiKey }) => {
  if (!iosApiKey) {
    console.warn('[withGoogleMapsKey] iosApiKey is missing. Google Maps may not work on iOS. Skipping plugin.');
    return config;
  }

  // 1. Add API Key to Info.plist (redundant if app.config.ts does it, but safe)
  config = withInfoPlist(config, (innerConfig) => {
    innerConfig.modResults.GoogleMapsApiKey = iosApiKey;
    return innerConfig;
  });

  // 2. Inject import and initialization into AppDelegate
  config = withAppDelegate(config, (innerConfig) => {
    const { contents } = innerConfig.modResults;
    let newContents = contents;
    // ... (rest of logic) ...
    innerConfig.modResults.contents = newContents;
    return innerConfig;
  });

  return config;
};

module.exports = withGoogleMapsKey;
