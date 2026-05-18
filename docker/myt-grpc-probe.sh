#!/usr/bin/env bash
# MYT gRPC probe — run inside the tachi-server container.
#
#   kubectl exec -it deploy/tachi-server -- sh /app/docker/myt-grpc-probe.sh \
#     --access-code "YOUR_ACCESS_CODE" --game chunithm
#
# Or paste the block from the bottom of this file if the script is not on the image yet.

set -euo pipefail

TACHI_ROOT="${TACHI_ROOT:-/app}"
cd "${TACHI_ROOT}/typescript/server"
exec bun run src/scripts/myt-grpc-probe.ts -- "$@"

# --- paste into `kubectl exec ... -- sh` if this file is not on the image yet ---
# set -euo pipefail
# cd /app/typescript/server
# bun run src/scripts/myt-grpc-probe.ts -- --access-code "YOUR_ACCESS_CODE" --game chunithm
# bun run src/scripts/myt-grpc-probe.ts -- --profile-api-id "TITLE_API_ID" --game chunithm --max-items 1
