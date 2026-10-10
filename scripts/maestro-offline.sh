#!/usr/bin/env bash
# Runs the offline Maestro flows in three phases, with the network switched
# between them from outside Maestro. Usage, from the repository root:
#
#   scripts/maestro-offline.sh -e APP_ID=... -e E2E_TEST_EMAIL=... -e E2E_TEST_PASSWORD=...
#
# Every argument is passed to each `maestro test`. Needs `adb` and one device.
#
# Why phases: Maestro's own `setAirplaneMode` works, but airplane mode also
# switches the Bluetooth radio off and the app then shows "Please enable
# Bluetooth" ahead of everything else (runs 36921573134 and 36926971767, where
# taking bluetooth out of `airplane_mode_radios` changed nothing). Maestro
# cannot shell out, so the toggle and the Bluetooth restore happen here, and
# the app keeps its state across the three invocations (no clearState).
#
#   1. offline/sign-in-online.yaml         online: sign in, reach the project list
#   2. offline/complete-offline-workflow.yaml  airplane mode on: cold start stays
#      signed in, offline indicator, list from the local database, create a project
#   3. offline/database-operations.yaml    airplane mode off: the outbox pushes it,
#      a pull keeps it, archive it
#
# Writes maestro-report-offline-1.xml to -3.xml beside maestro-report.xml and
# exits non-zero if any phase failed. The network is restored whatever happens.
set -u
name="E2E offline $(date +%s)"

airplane() {
  adb shell cmd connectivity airplane-mode "$1" || adb shell settings put global airplane_mode_on "$([ "$1" = enable ] && echo 1 || echo 0)"
  sleep 3
  if [ "$1" = enable ]; then
    # Users may turn Bluetooth back on in airplane mode, and so may adb
    adb shell svc bluetooth enable || true
    sleep 3
  fi
  echo "airplane_mode_on=$(adb shell settings get global airplane_mode_on 2>/dev/null) bluetooth_on=$(adb shell settings get global bluetooth_on 2>/dev/null)"
}

status=0
run() {
  maestro test "$@" || status=$?
}

run "${@}" --format junit --output maestro-report-offline-1.xml tests/maestro/offline/sign-in-online.yaml
if [ "$status" -eq 0 ]; then
  airplane enable
  run "${@}" -e OFFLINE_PROJECT_NAME="$name" --format junit --output maestro-report-offline-2.xml tests/maestro/offline/complete-offline-workflow.yaml
  airplane disable
  if [ "$status" -eq 0 ]; then
    run "${@}" -e OFFLINE_PROJECT_NAME="$name" --format junit --output maestro-report-offline-3.xml tests/maestro/offline/database-operations.yaml
  fi
else
  echo "sign-in failed, the offline phases did not run"
fi
exit "$status"
