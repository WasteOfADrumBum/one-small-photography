#!/usr/bin/env bash
# Lints the GitHub Actions workflows: actionlint (syntax, expressions, shell)
# and zizmor (dangerous patterns: injection, credential persistence, unpinned
# actions, excessive permissions). Pinned releases, verified by checksum.
set -euo pipefail

ACTIONLINT_VERSION=1.7.12
ACTIONLINT_SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
ZIZMOR_VERSION=1.31.1
ZIZMOR_SHA256=d185f726bdaf92df78273217dfdd24ebcd6b0ef48cf3ce776ff5762b6e138c99

bin="${RUNNER_TEMP:-/tmp}/workflow-lint-bin"
mkdir -p "$bin"

fetch() { # url sha256 file
  curl -sSfL --retry 3 --max-time 60 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet -
}

if [[ ! -x "$bin/actionlint" ]]; then
  fetch "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" \
    "$ACTIONLINT_SHA256" "$bin/actionlint.tgz"
  tar -xzf "$bin/actionlint.tgz" -C "$bin" actionlint
fi
if [[ ! -x "$bin/zizmor" ]]; then
  fetch "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-x86_64-unknown-linux-gnu.tar.gz" \
    "$ZIZMOR_SHA256" "$bin/zizmor.tgz"
  tar -xzf "$bin/zizmor.tgz" -C "$bin" zizmor
fi

"$bin/actionlint" -color
# Offline: no GitHub API calls, so no token is needed or exposed.
"$bin/zizmor" --offline --min-severity low .github/workflows
