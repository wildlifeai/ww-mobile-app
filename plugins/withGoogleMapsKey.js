const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const withGoogleMapsKey = (config, { iosApiKey }) => {
  if (!iosApiKey) {
    console.warn('[withGoogleMapsKey] iosApiKey is missing. Google Maps may not work on iOS. Skipping plugin.');
    return config;
  }

  // 1. Add API Key to Info.plist (redundant if app.config.ts does it, but safe)
  config = withInfoPlist(config, (config) => {
    config.modResults.GoogleMapsApiKey = iosApiKey;
    return config;
  });

  // 2. Inject import and initialization into AppDelegate
  config = withAppDelegate(config, (config) => {
    const { language, contents } = config.modResults;
    let newContents = contents;

    if (language === 'swift') {
      // --- SWIFT LOGIC ---

      // Add Import
      if (!newContents.includes('import GoogleMaps')) {
        // Try to add after 'import Expo' or 'import UIKit'
        if (newContents.includes('import Expo')) {
          newContents = newContents.replace('import Expo', 'import Expo\nimport GoogleMaps');
        } else if (newContents.includes('import UIKit')) {
           newContents = newContents.replace('import UIKit', 'import UIKit\nimport GoogleMaps');
        } else {
           newContents = `import GoogleMaps\n${newContents}`;
        }
      }

      // Add Initialization
      if (!newContents.includes('GMSServices.provideAPIKey')) {
        // Robust regex for Swift method signature (handling override, spaces, etc.)
        // Matches: override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        const swiftMethodRegex = /(func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\)\s*->\s*Bool\s*\{)/;
        
        if (swiftMethodRegex.test(newContents)) {
          newContents = newContents.replace(
            swiftMethodRegex,
            `$1\n    GMSServices.provideAPIKey("${iosApiKey}")`
          );
        }
      }

    } else {
      // --- OBJECTIVE-C / C++ LOGIC ---
      
      // Add Import
      if (!newContents.includes('#import <GoogleMaps/GoogleMaps.h>')) {
        if (/#import ["<]AppDelegate.h[">]/.test(newContents)) {
          newContents = newContents.replace(
            /(#import ["<]AppDelegate.h[">])/,
            `$1\n#import <GoogleMaps/GoogleMaps.h>`
          );
        } else {
          newContents = `#import <GoogleMaps/GoogleMaps.h>\n${newContents}`;
        }
      }

      // Add Initialization
      if (!newContents.includes('[GMSServices provideAPIKey:')) {
        // Regex for Obj-C method signature
        const objCMethodRegex = /(- \(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{)/;
        
        if (objCMethodRegex.test(newContents)) {
          newContents = newContents.replace(
             objCMethodRegex,
             `$1\n  [GMSServices provideAPIKey:@"${iosApiKey}"];`
          );
        }
      }
    }

    config.modResults.contents = newContents;
    return config;
  });

  return config;
};

module.exports = withGoogleMapsKey;
