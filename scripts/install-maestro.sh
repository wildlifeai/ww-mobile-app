#!/usr/bin/env bash
# Installs the pinned Maestro CLI into ~/.maestro (bin/ and lib/, the layout
# get.maestro.mobile.dev produces), after checking the release zip against a
# pinned SHA-256. CI runs it in both E2E jobs and scripts/install-maestro-wsl2.sh
# runs it locally, so every run uses the same CLI. Only bin/ and lib/ are
# replaced: ~/.maestro/tests/ holds the run's output.
#
# Maestro publishes no checksums, so the hash is the one taken when the version
# was pinned. To bump: download
#   https://github.com/mobile-dev-inc/maestro/releases/download/cli-<version>/maestro.zip
# run `sha256sum` on it, and change both lines below in the same commit.
set -euo pipefail

MAESTRO_VERSION=2.11.0
MAESTRO_SHA256=5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a

dir="$HOME/.maestro"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl --fail --location --silent --show-error --output "$tmp/maestro.zip" \
  "https://github.com/mobile-dev-inc/maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip"
echo "${MAESTRO_SHA256}  $tmp/maestro.zip" | sha256sum --check --quiet

unzip -q "$tmp/maestro.zip" -d "$tmp"
mkdir -p "$dir"
rm -rf "$dir/bin" "$dir/lib"
cp -r "$tmp/maestro/." "$dir/"

"$dir/bin/maestro" --version
