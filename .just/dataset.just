# Known anonymised dataset filenames hosted at the CDN.
# Update these when new dumps are published.
dataset_cdn_base := "https://cdn-data.kamai.tachi.ac/datasets"

# Download an anonymised dataset dump from the CDN (if not already cached under
# datasets/) and restore it into a fresh local Postgres database called
# "tachi_dataset". Uses fzf to pick from the known list of available dumps.
# After loading, point POSTGRES_URL at that DB to use it.
load-tachi-dataset:
	#!/usr/bin/env bash
	set -euo pipefail

	known_datasets=(
		"tachi-kamai-2026-05.sql.gz"
		"tachi-boku-2026-05.sql.gz"
	)

	file=$(printf '%s\n' "${known_datasets[@]}" | fzf --prompt="Select dataset: ")

	local_file="datasets/$file"

	# Use the cached file if it already exists, otherwise fetch from CDN.
	if [[ -f "$local_file" ]]; then
		echo "==> Using cached $local_file"
	else
		echo "==> Downloading $file from CDN..."
		mkdir -p datasets
		wget --progress=bar:force -O "$local_file" "{{dataset_cdn_base}}/$file"
	fi

	target_db="tachi_dataset"

	echo "==> Preparing database '$target_db'..."
	# Terminate any open connections so DROP DATABASE can proceed.
	psql "{{POSTGRES_URL}}/postgres" -c \
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$target_db'"
	psql "{{POSTGRES_URL}}/postgres" -c "DROP DATABASE IF EXISTS \"$target_db\""
	psql "{{POSTGRES_URL}}/postgres" -c "CREATE DATABASE \"$target_db\""

	echo "==> Restoring $file into '$target_db'..."
	zcat "$local_file" | psql "{{POSTGRES_URL}}/$target_db"

	echo ""
	echo "Done! To use this dataset, set POSTGRES_URL in typescript/server/.env to:"
	echo "  {{POSTGRES_URL}}/$target_db"
