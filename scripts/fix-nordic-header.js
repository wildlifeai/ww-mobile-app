const fs = require('fs');
const path = require('path');

console.log('Running fix-nordic-header.js');
console.log('CWD:', process.cwd());

const filePath = path.join(process.cwd(), 'node_modules', '@circularing', 'react-native-nordic-dfu', 'ios', 'RNNordicDfu.h');

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
        console.log('Found RNNordicDfu.h at:', filePath);
        fs.writeFileSync(filePath, robustContent, 'utf8');
        console.log('Fix applied. Verifying content...');
        const newContent = fs.readFileSync(filePath, 'utf8');
        if (newContent === robustContent) {
            console.log('Content verification: PASSED');
        } else {
            console.error('Content verification: FAILED');
            process.exit(1);
        }
    } else {
        console.error('RNNordicDfu.h not found at:', filePath);
        // List parent dir
        const parentDir = path.dirname(filePath);
        if (fs.existsSync(parentDir)) {
            console.log('Listing directory:', parentDir);
            console.log(fs.readdirSync(parentDir));
        } else {
            console.log('Parent directory does not exist:', parentDir);
        }
        process.exit(1); // Fail build if we can't patch
    }
} catch (error) {
    console.error('Error applying fix:', error);
    process.exit(1);
}
