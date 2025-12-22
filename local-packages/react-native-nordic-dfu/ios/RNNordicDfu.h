#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/*
 * With dynamic frameworks, the standard module import should work.
 * The iOSDFULibrary exposes its Swift types through the NordicDFU module.
 */
#if __has_include(<NordicDFU/NordicDFU-Swift.h>)
#import <NordicDFU/NordicDFU-Swift.h>
#elif __has_include(<iOSDFULibrary/iOSDFULibrary-Swift.h>)
#import <iOSDFULibrary/iOSDFULibrary-Swift.h>
#else
@import iOSDFULibrary;
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
