const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', '@circularing', 'react-native-nordic-dfu', 'ios', 'RNNordicDfu.h');

const robustContent = `#import <CoreBluetooth/CoreBluetooth.h>
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
`;

try {
    if (fs.existsSync(filePath)) {
        console.log('Found RNNordicDfu.h, applying fix...');
        fs.writeFileSync(filePath, robustContent, 'utf8');
        console.log('Fix applied successfully.');
    } else {
        console.warn('RNNordicDfu.h not found at:', filePath);
        // Do not fail the build, as maybe the package is not installed yet or path changed.
        // But for this issue, it's critical.
    }
} catch (error) {
    console.error('Error applying fix:', error);
    process.exit(1);
}
