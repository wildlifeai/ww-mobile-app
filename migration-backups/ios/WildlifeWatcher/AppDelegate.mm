#import "AppDelegate.h"
#import "RNBootSplash.h"
#import <Firebase.h>
#import "RNNordicDfu.h"
#import <GoogleMaps/GoogleMaps.h>
#import <React/RCTBundleURLProvider.h>
#import "RNCConfig.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  NSString *googleMapsApiKey = [RNCConfig envFor:@"GOOGLE_MAPS_API_KEY_IOS"];
  if (googleMapsApiKey && ![googleMapsApiKey isEqualToString:@""]) {
    [GMSServices provideAPIKey:googleMapsApiKey];
  }
  [FIRApp configure];
  
  self.moduleName = @"WildlifeWatcher";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  [RNNordicDfu setCentralManagerGetter:^() {
    return [[CBCentralManager alloc] initWithDelegate:nil 
        queue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0)];
  }];

  [RNNordicDfu setOnDFUComplete:^() {
    NSLog(@"onDFUComplete");
  }];

  [RNNordicDfu setOnDFUError:^() {
    NSLog(@"onDFUError");
  }];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (BOOL) application: (UIApplication *)application
             openURL: (NSURL *)url
             options: (NSDictionary<UIApplicationOpenURLOptionsKey, id> *) options
{
  if ([self.authorizationFlowManagerDelegate resumeExternalUserAgentFlowWithURL:url]) {
    return YES;
  }
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (UIView *)createRootViewWithBridge:(RCTBridge *)bridge
                          moduleName:(NSString *)moduleName
                           initProps:(NSDictionary *)initProps {
  UIView *rootView = [super createRootViewWithBridge:bridge
                                          moduleName:moduleName
                                           initProps:initProps];

  [RNBootSplash initWithStoryboard:@"BootSplash" rootView:rootView]; // ⬅️ initialize the splash screen

  return rootView;
}

- (BOOL) application: (UIApplication *) application
continueUserActivity: (nonnull NSUserActivity *)userActivity
  restorationHandler: (nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  if ([userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
    if (self.authorizationFlowManagerDelegate) {
      BOOL resumableAuth = [self.authorizationFlowManagerDelegate resumeExternalUserAgentFlowWithURL:userActivity.webpageURL];
      if (resumableAuth) {
        return YES;
      }
    }
  }
  return [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
}

@end
