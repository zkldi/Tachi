start:
	#!/bin/bash
	set -euo pipefail
	ARGS=(server client seeds-webui)

	echo "Starting: ${ARGS[@]}"
	pids=()
	for target in ${ARGS[@]}; do
		(just "$target") &
		pids+=($!)
	done
	trap 'echo "Stopping all..."; kill -TERM ${pids[@]}; wait' SIGINT
	wait


server:
	#!/bin/bash
	set -euo pipefail
	cd typescript/server
	VERSION="${VERSION:-"$(jq -r .version package.json)"}"
	VERSION_DETAIL="${VERSION_DETAIL:-$(TZ=UTC0 git log -1 --format=%cd --date=format:%Y%m%d HEAD)-$(git rev-parse --short=7 HEAD)}"
	export VERSION VERSION_DETAIL
	sidecar_pids=()
	# Crons: Postgres-backed scheduler. Jobs: `job_queue` (SKIP LOCKED; embedded pool via TACHI_JOB_QUEUE_WORKER_POOL).
	if [[ -z "${TACHI_SERVER_NO_SIDECARS:-}" ]]; then
		bun run cron-worker & sidecar_pids+=($!)
		bun run job-queue-worker & sidecar_pids+=($!)
	fi
	_cleanup_sidecars() {
		trap - INT TERM EXIT
		local s=$?
		if ((${#sidecar_pids[@]})); then
			kill -TERM "${sidecar_pids[@]}" 2>/dev/null || true
			wait "${sidecar_pids[@]}" 2>/dev/null || true
		fi
		exit "$s"
	}
	trap _cleanup_sidecars INT TERM EXIT
	bun --watch src/main.ts

client:
	cd typescript/client && bun vite

seeds-webui:
	cd typescript/seeds-webui && bun vite

homepage:
	cd typescript/homepage && bun vite
