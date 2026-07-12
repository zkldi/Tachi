# reload the shell setup
setup-fish:
	fish dev/setup.fish
	exec fish

# Set up the codebase.
setup:
	./dev/bootstrap.sh -f

# Verify every Dockerfile in-repo that CI builds (excludes docs: see .github/workflows/docs.yml + Dockerfile.docs).
check-all-docker-builds: assert-docker-host
	#!/usr/bin/env bash
	set -euo pipefail
	root="$(git rev-parse --show-toplevel)"
	server_ver="$(jq -r .version "$root/typescript/server/package.json")"
	detail="$(TZ=UTC0 git -C "$root" log -1 --format=%cd --date=format:%Y%m%d HEAD)-$(git -C "$root" rev-parse --short=7 HEAD)"
	full="$(git -C "$root" rev-parse HEAD)"
	bt="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	echo "==> server (prod)"
	docker build -f "$root/docker/Dockerfile.server" --target prod \
		--build-arg "VERSION=$server_ver" \
		--build-arg "VERSION_DETAIL=$detail" \
		--build-arg "GIT_REVISION=$full" \
		--build-arg "BUILD_TIME=$bt" \
		-t tachi-server:check "$root"
	echo "==> bot"
	docker build -f "$root/docker/Dockerfile.bot" \
		--build-arg "GIT_REVISION=$full" \
		--build-arg "BUILD_TIME=$bt" \
		-t tachi-bot:check "$root"
	echo "==> github-bot"
	docker build -f "$root/docker/Dockerfile.ghbot" \
		--build-arg "GIT_REVISION=$full" \
		--build-arg "BUILD_TIME=$bt" \
		-t tachi-ghbot:check "$root"
	echo "==> dev image"
	docker build -f "$root/Dockerfile.dev" -t tachi-dev:check "$root"
	echo "All Docker builds succeeded."
