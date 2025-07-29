const { getDefaultConfig } = require("expo/metro-config")

/**
 * Metro configuration for Expo
 * https://docs.expo.dev/guides/customizing-metro/
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname)

// Add custom asset extensions for Wildlife Watcher app
config.resolver.assetExts.push('db', 'zip')

module.exports = config
