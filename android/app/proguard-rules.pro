# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Google Maps SDK — prevent R8 from stripping map classes in release builds
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.common.** { *; }

# react-native-maps (AirMaps)
-keep class com.airbnb.android.react.maps.** { *; }

# Add any project specific keep options here:
