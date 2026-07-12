#!/bin/bash


set -eo pipefail

# https://stackoverflow.com/questions/59895/how-can-i-get-the-directory-where-a-bash-script-is-located-from-within-the-scrip
# if you actually think bash is a good programming language you are
# *straight up delusional*
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$SCRIPT_DIR";

echo "Calculating Sieglinde..."
cd ../../../../sieglinde && bun run calc-v1 "$@"

cd "$SCRIPT_DIR"

bun run apply-sieglinde.js