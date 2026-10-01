#!/usr/bin/env bash
# Prints what a Maestro run left behind into the job log, so a failure can be
# read without downloading the artifact: the junit report, a compact view of
# every screen hierarchy (resource id, text, accessibility text, bounds), the
# tail of each flow's command log, maestro.log and the app's logcat.
#
# Runs after scripts/ci-maestro.sh, outside the emulator. It first redacts
# E2E_TEST_PASSWORD from every file the artifact uploads: Maestro writes the
# resolved text of each inputText into its command log, and the artifact of a
# public repository is downloadable by anyone signed in to GitHub.
set -u
tests_dir="$HOME/.maestro/tests"

if [ -n "${E2E_TEST_PASSWORD:-}" ]; then
  export PW="$E2E_TEST_PASSWORD"
  grep -rlF -- "$PW" "$tests_dir" maestro-report.xml final-hierarchy.json device-logcat.txt 2>/dev/null \
    | while read -r f; do perl -pi -e 's/\Q$ENV{PW}\E/[redacted]/g' "$f"; done
fi

compact='[.. | objects | select(has("attributes")) | .attributes
  | {id: .["resource-id"], text: .text, acc: .accessibilityText, bounds: .bounds}]
  | map(select(((.id // "") != "") or ((.text // "") != "") or ((.acc // "") != "")))
  | .[] | "\(.id // "-") | \(.text // "-") | \(.acc // "-") | \(.bounds // "-")"'

echo "::group::maestro-report.xml"
cat maestro-report.xml 2>/dev/null || echo "(no report)"
echo "::endgroup::"

echo "::group::files"
find "$tests_dir" -type f 2>/dev/null | sort
echo "::endgroup::"

for f in $(find "$tests_dir" -type f -name '*.json' 2>/dev/null | sort) final-hierarchy.json; do
  [ -f "$f" ] || continue
  echo "::group::$f (compact)"
  if jq -e '.. | objects | select(has("attributes"))' "$f" >/dev/null 2>&1; then
    jq -r "$compact" "$f" 2>/dev/null | head -400
  else
    # Not a hierarchy: a command log. The tail holds the failing command.
    jq -c '.[-12:]' "$f" 2>/dev/null | head -c 6000 || tail -c 4000 "$f"
  fi
  echo
  echo "::endgroup::"
done

for f in $(find "$tests_dir" -type f -name 'maestro.log' 2>/dev/null | sort); do
  echo "::group::$f (tail)"
  tail -n 150 "$f"
  echo "::endgroup::"
done

echo "::group::device-logcat.txt (tail)"
tail -n 300 device-logcat.txt 2>/dev/null || echo "(no logcat)"
echo "::endgroup::"
