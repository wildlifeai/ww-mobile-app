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
  
  s.swift_version = '5.0'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '$(PODS_TARGET_SRCROOT)/ios',
    'OTHER_SWIFT_FLAGS' => '-import-underlying-module'
  }

  s.dependency "React-Core"
  s.dependency 'iOSDFULibrary', '~> 4.15.3'
end
