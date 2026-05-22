#!/bin/bash
# moves example .env files, generates certificates, etc.

set -eo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

FORCE=0

while getopts "f" opt; do
	case $opt in
		f)
			FORCE=1
			;;
		*)
			echo "Invalid option: -$opt"
			exit 1
	esac
done

cd "$SCRIPT_DIR";
cd ..;

function setupShell {
	echo "Setting up fish..."
	fish dev/setup.fish
}

function mvExampleFiles {
	echo "Moving example config files into usable places..."

	cp --update=none typescript/client/example/.env typescript/client/.env

	echo "Moved!"
}

function seedMinioCdn {
	# Uploads example/default-cdn-contents when MinIO is up. Buckets + anonymous download use MinIO client;
	# Debian package `minio-client` installs the `minio-client` binary (same CLI as upstream `mc`).
	# override endpoint with MINIO_ENDPOINT (devcontainer sets http://tachi-s3:9000).
	if ! command -v minio-client &> /dev/null; then
		echo "Couldn't find MinIO client (minio-client). On Debian: apt install minio-client - see Dockerfile.dev."
		exit 1
	fi

	(
		MC_CONFIG_DIR=$(mktemp -d)
		trap 'rm -rf "$MC_CONFIG_DIR"' EXIT
		MINIO_ENDPOINT="http://tachi-s3:9000"
		MC=(minio-client --config-dir "$MC_CONFIG_DIR")
		MC_ALIAS="tachi-s3"

		if ! "${MC[@]}" alias set "$MC_ALIAS" "$MINIO_ENDPOINT" minio password --api s3v4; then
			echo "Could not seed MinIO CDN (start compose and tachi-s3, then re-run bootstrap with -f or upload manually)."
			exit 0
		fi

		for b in tachi-public tachi-private tachi-backups; do
			"${MC[@]}" mb --ignore-existing "${MC_ALIAS}/${b}" 2>/dev/null || true
		done

		# Public reads only for tachi-public (dev/minio-tachi-public-bucket-policy.json). tachi-private and tachi-backups stay private.
		if ! "${MC[@]}" anonymous set download "${MC_ALIAS}/tachi-public"; then
			echo "Could not set anonymous download on tachi-public (MinIO up?)."
		fi

		if "${MC[@]}" cp --recursive typescript/server/example/default-cdn-contents/ "${MC_ALIAS}/tachi-public/"; then
			echo "Uploaded default CDN assets to MinIO."
		else
			echo "Could not seed MinIO CDN (start compose and tachi-s3, then re-run bootstrap with -f or upload manually)."
		fi
		exit 0
	)
}

function bunInstall {
	echo "Installing dependencies..."

	if ! command -v bun &> /dev/null
	then
		echo "Couldn't find bun. Can't install dependencies. Install it from https://bun.sh."
		exit 1
	fi

	bun install

	echo "Installed dependencies."
}

function configureGitHooks {
	echo "Configuring git hooks path..."
	git config core.hooksPath .githooks
	echo "Git hooks path set to .githooks."
}

function syncDatabaseWithSeeds {
	echo "Syncing database with seeds..."

	# TODO(zk)
	echo "[DISABLED] FOR NOW"
	return 0; 

	(
		cd typescript/server

		bun run load-seeds
	)

	echo "Synced."
}

# always setup the shell
setupShell
mvExampleFiles
seedMinioCdn
bunInstall
configureGitHooks

if [ -e _SETUP_OK ] && [ $FORCE -eq 0 ]; then
	echo "Already bootstrapped."
	exit 0
fi

syncDatabaseWithSeeds

echo "Bootstrap Complete."

cat << EOF > _SETUP_OK
Tachi(v3) was setup here on $(date).

The existence of this file stops Tachi from running a setup again.
There's nothing harmful about this -- you can setup as much as you want!
We just don't want to necessarily setup *each* time we boot Tachi.

To setup again (in case you think something has gone wrong)
run 'just setup'.
EOF
