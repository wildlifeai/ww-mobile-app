#!/usr/bin/env bash
# Runs the Maestro flows in CI, inside android-emulator-runner's script, where the
# emulator is alive. Usage: scripts/ci-maestro.sh <flow file or directory>
#
# Both CI profiles are release-type (eas.json `e2e` and `staging`) and install as
# com.wildlife.wildlifewatcher. E2E_TEST_EMAIL and E2E_TEST_PASSWORD come from the
# job's environment when the flows need an account; they are empty on the smoke
# job, which signs nobody in.
#
# When the target is the whole tests/maestro/ directory, the offline phases run
# after it through scripts/maestro-offline.sh, which switches the network from
# outside Maestro.
#
# Exits non-zero if anything failed, after dumping the final screen's hierarchy
# and the app's logcat into the log: the artifact is not the only way to read a
# failure.
set -u
target="$1"
export MAESTRO_CLI_NO_ANALYTICS=1

adb install -r ./app-debug.apk

# src/navigation/index.tsx shows "Please enable Bluetooth" ahead of the login
# screen while the adapter is off, and the emulator's emulated adapter starts
# in whatever state the image left it. Harmless when it is already on.
adb shell svc bluetooth enable || true
# A system "isn't responding" dialog (Pixel Launcher, on 5 Oct 2026) sat over the app while
# the first assertion ran, and a flow that cannot see the screen fails for nothing.
# hide_error_dialogs did not stop it: on 9 and 10 Oct it failed 4 of 24 smoke runs, each
# started while four or five PR builds ran at once (runs 37983176738, 38022379168). The
# flows start the app themselves and never use the home screen, so the launcher is
# disabled and there is nothing left to stop responding. The setting stays for any other
# app's dialog. Harmless on an image with another launcher: the command just fails.
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher || true
adb shell settings put global hide_error_dialogs 1 || true
echo "bluetooth_on=$(adb shell settings get global bluetooth_on 2>/dev/null)"

env_args=(-e APP_ID=com.wildlife.wildlifewatcher -e E2E_TEST_EMAIL="${E2E_TEST_EMAIL:-}" -e E2E_TEST_PASSWORD="${E2E_TEST_PASSWORD:-}")
status=0
maestro test "${env_args[@]}" --format junit --output maestro-report.xml "$target" || status=$?

if [ "${target%/}" = "tests/maestro" ]; then
  bash scripts/maestro-offline.sh "${env_args[@]}" || status=$?
fi

# The screen the last flow ended on, for selectors, with the password field's
# text already masked by the OS (secureTextEntry).
maestro hierarchy > final-hierarchy.json 2>/dev/null || true
adb logcat -d -v time ReactNativeJS:V AndroidRuntime:E ActivityManager:I '*:S' > device-logcat.txt 2>/dev/null || true

exit "$status"
