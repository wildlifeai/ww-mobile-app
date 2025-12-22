#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#if __has_include(<iOSDFULibrary/iOSDFULibrary-Swift.h>)
#import <iOSDFULibrary/iOSDFULibrary-Swift.h>
#elif __has_include("iOSDFULibrary-Swift.h")
#import "iOSDFULibrary-Swift.h"
#else
#import <iOSDFULibrary-Swift.h>
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
