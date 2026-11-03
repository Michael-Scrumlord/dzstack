#!/usr/bin/env bash
# The "unit-shuffled" CI job. The seed is printed first so a red run can be repeated exactly.
set -euo pipefail
export CI_SHUFFLE_SEED="${CI_SHUFFLE_SEED:-$RANDOM}"
echo "shuffle seed: ${CI_SHUFFLE_SEED}  TZ: ${TZ:-unset}  host: $(hostname)"
python3 -m pytest -q
