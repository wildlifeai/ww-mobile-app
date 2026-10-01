#!/usr/bin/env bash
# Runs the Maestro flows in CI, inside android-emulator-runner's script, where the
# emulator is alive. Usage: scripts/ci-maestro.sh <flow file or directory>
#
# Both CI profiles are release-type (eas.json `e2e` and `staging`) and install as
# com.wildlife.wildlifewatcher. E2E_TEST_EMAIL and E2E_TEST_PASSWORD come from the
# job's environment when the flows need an account; they are empty on the smoke
# job, which signs nobody in.
#
# Exits with Maestro's status, after dumping the final screen's hierarchy and the
# app's logcat into the log: the artifact is not the only way to read a failure.
set -u
target="$1"
export MAESTRO_CLI_NO_ANALYTICS=1

adb install -r ./app-debug.apk

# src/navigation/index.tsx shows "Please enable Bluetooth" ahead of the login
# screen while the adapter is off, and the emulator's emulated adapter starts
# in whatever state the image left it. Harmless when it is already on.
adb shell svc bluetooth enable || true
echo "bluetooth_on=$(adb shell settings get global bluetooth_on 2>/dev/null)"

# The offline flows use Maestro's setAirplaneMode, and airplane mode turns the
# Bluetooth radio off too, which puts the app on "Please enable Bluetooth"
# (run 36921573134). AIRPLANE_MODE_RADIOS lists the radios airplane mode
# switches; without bluetooth in it, the adapter stays on.
adb shell settings put global airplane_mode_radios cell,wifi,nfc,wimax || true
echo "airplane_mode_radios=$(adb shell settings get global airplane_mode_radios 2>/dev/null)"

status=0
maestro test \
  -e APP_ID=com.wildlife.wildlifewatcher \
  -e E2E_TEST_EMAIL="${E2E_TEST_EMAIL:-}" \
  -e E2E_TEST_PASSWORD="${E2E_TEST_PASSWORD:-}" \
  --format junit --output maestro-report.xml "$target" || status=$?

# The screen the last flow ended on, for selectors, with the password field's
# text already masked by the OS (secureTextEntry).
maestro hierarchy > final-hierarchy.json 2>/dev/null || true
adb logcat -d -v time ReactNativeJS:V AndroidRuntime:E ActivityManager:I '*:S' > device-logcat.txt 2>/dev/null || true

exit "$status"
