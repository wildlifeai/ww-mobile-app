
path = r"node_modules/@circularing/react-native-nordic-dfu/ios/RNNordicDfu.h"
content = """#import <CoreBluetooth/CoreBluetooth.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#if __has_include("iOSDFULibrary-Swift.h")
#import "iOSDFULibrary-Swift.h"
#else
#import <NordicDFU/NordicDFU-Swift.h>
#endif

@interface RNNordicDfu : RCTEventEmitter<RCTBridgeModule, DFUServiceDelegate, DFUProgressDelegate, LoggerDelegate>

@property (strong, nonatomic) NSString * deviceAddress;
@property (strong, nonatomic) RCTPromiseResolveBlock resolve;
@property (strong, nonatomic) RCTPromiseRejectBlock reject;

+ (void)setCentralManagerGetter:(CBCentralManager * (^)())getter;
+ (void)setOnDFUComplete:(void (^)())onComplete;
+ (void)setOnDFUError:(void (^)())onError;

@end
"""

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Header patched successfully.")
