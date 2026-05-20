#!/usr/bin/env bash
# Run the MYT gRPC probe under Node (not Bun) for A/B against Bun/http2 issues.
#
#   /app/docker/myt-grpc-probe-node.sh --stream-only \
#     --profile-api-id "TITLE_API_ID" --pause-ms 50 --max-items 999999
#
# Uses `bun build` once to emit /tmp/myt-grpc-probe.node.mjs, then `node` to execute.

set -euo pipefail

TACHI_ROOT="${TACHI_ROOT:-/app}"
SERVER_DIR="${TACHI_ROOT}/typescript/server"
OUT="/tmp/myt-grpc-probe.node.mjs"

cd "${SERVER_DIR}"

if [[ ! -f "${OUT}" ]] || [[ "src/scripts/myt-grpc-probe.ts" -nt "${OUT}" ]]; then
	echo "[myt-grpc-probe-node] bundling probe for Node -> ${OUT}" >&2
	bun build src/scripts/myt-grpc-probe.ts --target=node --format=esm --outfile="${OUT}" >&2
fi

exec node "${OUT}" "$@"
