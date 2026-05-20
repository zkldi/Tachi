#!/usr/bin/env sh
# MYT gRPC probe — run inside the tachi-server container.

set -euo pipefail

TACHI_ROOT="${TACHI_ROOT:-/app}"
cd "${TACHI_ROOT}/typescript/server"
exec bun run src/scripts/myt-grpc-probe.ts -- "$@"

# Node A/B: /app/docker/myt-grpc-probe-node.sh (same flags, no leading "--" required)

# set -euo pipefail
# cd /app/typescript/server
# bun run src/scripts/myt-grpc-probe.ts -- --access-code "YOUR_ACCESS_CODE" --game chunithm
# bun run src/scripts/myt-grpc-probe.ts -- --profile-api-id "TITLE_API_ID" --game chunithm --max-items 1
