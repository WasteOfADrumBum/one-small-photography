#!/usr/bin/env bash
# Looks for committed secrets (API keys, tokens, private keys, connection
# strings with passwords) in the files and the whole git history, with a
# pinned, checksum-verified gitleaks. Findings are redacted in the output.
set -euo pipefail

GITLEAKS_VERSION=8.30.1
GITLEAKS_SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb

bin="${RUNNER_TEMP:-/tmp}/secret-scan-bin"
mkdir -p "$bin"
if [[ ! -x "$bin/gitleaks" ]]; then
  curl -sSfL --retry 3 --max-time 60 -o "$bin/gitleaks.tgz" \
    "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
  echo "$GITLEAKS_SHA256  $bin/gitleaks.tgz" | sha256sum -c --quiet -
  tar -xzf "$bin/gitleaks.tgz" -C "$bin" gitleaks
fi

"$bin/gitleaks" git --redact --no-banner --config .gitleaks.toml --exit-code 1 .
