#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/*
 * The Swift bridging header for iOSDFULibrary is actually named
 * NordicDFU-Swift.h because the module name is NordicDFU, but it's packaged in
 * a pod called iOSDFULibrary. We use __has_include to cover all possible
 * locations found in the build logs.
 */
#if __has_include(<NordicDFU/NordicDFU-Swift.h>)
#import <NordicDFU/NordicDFU-Swift.h>
#elif __has_include("NordicDFU-Swift.h")
#import "NordicDFU-Swift.h"
#elif __has_include(<NordicDFU-Swift.h>)
#import <NordicDFU-Swift.h>
#elif __has_include(<iOSDFULibrary/iOSDFULibrary-Swift.h>)
#import <iOSDFULibrary/iOSDFULibrary-Swift.h>
#else
#import "iOSDFULibrary-Swift.h"
#endif

@interface RNNordicDfu : RCTEventEmitter <RCTBridgeModule, DFUServiceDelegate,
                                          DFUProgressDelegate, LoggerDelegate>

@property(strong, nonatomic) NSString *deviceAddress;
@property(strong, nonatomic) RCTPromiseResolveBlock resolve;
@property(strong, nonatomic) RCTPromiseRejectBlock reject;

+ (void)setCentralManagerGetter:(CBCentralManager * (^)())getter;
+ (void)setOnDFUComplete:(void (^)())onComplete;
+ (void)setOnDFUError:(void (^)())onError;

@end
