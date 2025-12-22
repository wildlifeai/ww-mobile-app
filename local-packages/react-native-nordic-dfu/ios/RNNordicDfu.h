#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/*
 * The Swift bridging header for iOSDFULibrary is actually named
 * NordicDFU-Swift.h because the module name is NordicDFU. The Podfile
 * post_install hook adds the correct search path:
 * $(BUILT_PRODUCTS_DIR)/iOSDFULibrary/Swift Compatibility Header
 */
#import "NordicDFU-Swift.h"

@interface RNNordicDfu : RCTEventEmitter <RCTBridgeModule, DFUServiceDelegate,
                                          DFUProgressDelegate, LoggerDelegate>

@property(strong, nonatomic) NSString *deviceAddress;
@property(strong, nonatomic) RCTPromiseResolveBlock resolve;
@property(strong, nonatomic) RCTPromiseRejectBlock reject;

+ (void)setCentralManagerGetter:(CBCentralManager * (^)())getter;
+ (void)setOnDFUComplete:(void (^)())onComplete;
+ (void)setOnDFUError:(void (^)())onError;

@end
