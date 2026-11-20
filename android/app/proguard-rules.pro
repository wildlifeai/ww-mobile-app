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

# Add any project specific keep options here:

# Expo's Kotlin module layer (#513). With R8 optimisation on, every call that
# passes an options object to an Expo module failed: Expo builds those
# "records" by reflection, and its optimised converter threw a
# NullPointerException ("The 1st argument cannot be cast to type
# expo.modules.location.records.LocationOptions"). Getting the phone's location
# and saving a photo downloaded from the camera both broke. Keeping
# kotlin-reflect did not help; keeping this package did.
-keep class expo.modules.kotlin.** { *; }
