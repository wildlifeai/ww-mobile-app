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

// Add auth redirect handler
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Handle auth redirect URLs
      if (req.url.includes('/auth/reset-password') || req.url.includes('/auth/callback')) {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const redirectTo = url.searchParams.get('redirect_to')
        
        if (redirectTo) {
          // Pass through all query parameters to the redirect URL
          const redirectUrl = redirectTo + url.search
          console.log('Redirecting to:', redirectUrl)
          
          // Create HTML page that redirects to the app
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Wildlife Watcher - Redirecting...</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
              <h2>Opening Wildlife Watcher App...</h2>
              <p>If the app doesn't open automatically, <a href="${redirectUrl}" id="openApp">click here</a></p>
              <script>
                // Automatically redirect to the app
                setTimeout(() => {
                  window.location.href = "${redirectUrl}";
                }, 1000);
              </script>
            </body>
            </html>
          `
          
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
          return
        }
      }
      
      // Continue with normal middleware
      return middleware(req, res, next)
    }
  },
}


module.exports = config
