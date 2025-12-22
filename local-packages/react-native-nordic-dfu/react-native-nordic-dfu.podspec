require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "react-native-nordic-dfu"
  s.version      = package['version']
  s.summary      = package['description']

  s.authors      = { "Circular" => "teddy.fontaine@circular.xyz" }
  s.homepage     = "https://github.com/circularing/react-native-nordic-dfu"
  s.license      = "Apache License 2.0"
  s.platform     = :ios, "12.0"

  s.source       = { :git => "https://github.com/circularing/react-native-nordic-dfu.git" }
  s.source_files  = "ios/**/*.{h,m}"
  
  s.static_framework = true
  s.swift_version = '5.0'
  
  # The Swift bridging header is named NordicDFU-Swift.h (matching the module name, not the pod name).
  # In static framework builds, it's placed in the Swift Compatibility Header subdirectory.
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => [
      '"$(BUILT_PRODUCTS_DIR)/iOSDFULibrary/Swift Compatibility Header"',
      '"$(PODS_ROOT)/Headers/Public/NordicDFU"',
      '"$(PODS_TARGET_SRCROOT)/ios"'
    ].join(' '),
    'SWIFT_INCLUDE_PATHS' => '"$(BUILT_PRODUCTS_DIR)"'
  }

  s.dependency "React-Core"
  s.dependency 'iOSDFULibrary', '~> 4.15.3'
end
