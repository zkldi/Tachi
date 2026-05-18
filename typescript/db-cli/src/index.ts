#!/usr/bin/env bun

// WARNING: This is claude-slop and not reviewed by me

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { Client } from "pg";
import { applyMigrations, getMigrationInfo, revertLastMigration } from "tachi-db-migration-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_MIGRATIONS_DIR = "/tachi/db/migrations";

function getConnectionString(opts: { databaseUrl?: string }): string {
	const url = opts.databaseUrl ?? process.env.POSTGRES_URL;

	if (!url) {
		console.error(
			"[migrate] No database URL provided. Set POSTGRES_URL, or pass --database-url.",
		);
		process.exit(1);
	}

	return url;
}

function resolveSource(source: string): string {
	return resolve(process.cwd(), source);
}

/** Format a Date as "YYYY-MM-DD HH:MM:SS" in local time. */
function formatDate(d: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");

	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
		`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
	);
}

/** Return a YYYYMMDDHHMMSS timestamp string. */
function timestamp(): string {
	const now = new Date();
	const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

	return (
		`${now.getFullYear()}` +
		`${pad(now.getMonth() + 1)}` +
		`${pad(now.getDate())}` +
		`${pad(now.getHours())}` +
		`${pad(now.getMinutes())}` +
		`${pad(now.getSeconds())}`
	);
}

/**
 * Parse the database name out of a postgres connection URL and return a client
 * connected to the "postgres" maintenance database (same host/credentials).
 */
async function connectToMaintenanceDb(connectionString: string): Promise<[Client, string]> {
	const url = new URL(connectionString);
	const dbName = url.pathname.slice(1); // strip leading "/"

	if (!dbName) {
		throw new Error(
			`Could not parse database name from connection string: ${connectionString}`,
		);
	}

	url.pathname = "/postgres";

	const maintenanceClient = new Client({ connectionString: url.toString() });

	await maintenanceClient.connect();

	return [maintenanceClient, dbName];
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
	.name("tachi-migrate")
	.description("Database migration CLI, modelled after sqlx migrate.")
	.option("--database-url <url>", "Postgres connection string (overrides POSTGRES_URL env var)");

// ---------------------------------------------------------------------------
// database subcommands
// ---------------------------------------------------------------------------

const databaseCmd = program.command("database").description("Create or drop the database.");

databaseCmd
	.command("create")
	.description("Create the database specified by POSTGRES_URL.")
	.action(async () => {
		const parentOpts = program.opts<{ databaseUrl?: string }>();
		const connectionString = getConnectionString(parentOpts);

		let client: Client | undefined;

		try {
			const [maintenanceClient, dbName] = await connectToMaintenanceDb(connectionString);

			client = maintenanceClient;

			await client.query(`CREATE DATABASE "${dbName}"`);
			console.log(`[migrate] Database "${dbName}" created.`);
		} catch (err) {
			console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
			process.exit(1);
		} finally {
			await client?.end();
		}
	});

databaseCmd
	.command("drop")
	.description("Drop the database specified by POSTGRES_URL.")
	.action(async () => {
		const parentOpts = program.opts<{ databaseUrl?: string }>();
		const connectionString = getConnectionString(parentOpts);

		let client: Client | undefined;

		try {
			const [maintenanceClient, dbName] = await connectToMaintenanceDb(connectionString);

			client = maintenanceClient;

			const exists = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
				dbName,
			]);

			await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);

			if (exists.rowCount === 0) {
				console.log(`[migrate] Database "${dbName}" does not exist; nothing to drop.`);
			} else {
				console.log(`[migrate] Database "${dbName}" dropped.`);
			}
		} catch (err) {
			console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
			process.exit(1);
		} finally {
			await client?.end();
		}
	});

// ---------------------------------------------------------------------------
// migrate subcommands
// ---------------------------------------------------------------------------

const migrateCmd = program.command("migrate").description("Create and run migrations.");

migrateCmd
	.command("add <name>")
	.description(
		"Create a new migration with the given description. " +
			"Use -r to create reversible up/down files.",
	)
	.option("-r, --reversible", "Create reversible .up.sql and .down.sql files.")
	.option("--source <dir>", "Directory for migration scripts.", "db/migrations")
	.action((name: string, opts: { reversible?: boolean; source: string }) => {
		const migrationsDir = resolveSource(opts.source);

		if (!existsSync(migrationsDir)) {
			mkdirSync(migrationsDir, { recursive: true });
		}

		const ts = timestamp();
		const safeName = name.replace(/\s+/gu, "_");

		if (opts.reversible) {
			const upFile = join(migrationsDir, `${ts}_${safeName}.up.sql`);
			const downFile = join(migrationsDir, `${ts}_${safeName}.down.sql`);

			writeFileSync(upFile, "");
			writeFileSync(downFile, "");

			console.log(`Creating ${upFile}`);
			console.log(`Creating ${downFile}`);
		} else {
			const file = join(migrationsDir, `${ts}_${safeName}.sql`);

			writeFileSync(file, "");
			console.log(`Creating ${file}`);
		}
	});

migrateCmd
	.command("run")
	.description("Run all pending migrations.")
	.option("--source <dir>", "Directory for migration scripts.", DEFAULT_MIGRATIONS_DIR)
	.action(async (opts: { source: string }) => {
		const parentOpts = program.opts<{ databaseUrl?: string }>();
		const connectionString = getConnectionString(parentOpts);
		const migrationsDir = resolveSource(opts.source);

		try {
			await applyMigrations(connectionString, migrationsDir);
		} catch (err) {
			console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

migrateCmd
	.command("revert")
	.description("Revert the latest migration (requires a .down.sql file).")
	.option("--source <dir>", "Directory for migration scripts.", DEFAULT_MIGRATIONS_DIR)
	.action(async (opts: { source: string }) => {
		const parentOpts = program.opts<{ databaseUrl?: string }>();
		const connectionString = getConnectionString(parentOpts);
		const migrationsDir = resolveSource(opts.source);

		try {
			await revertLastMigration(connectionString, migrationsDir);
		} catch (err) {
			console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

migrateCmd
	.command("info")
	.description("List all available migrations and their applied status.")
	.option("--source <dir>", "Directory for migration scripts.", DEFAULT_MIGRATIONS_DIR)
	.action(async (opts: { source: string }) => {
		const parentOpts = program.opts<{ databaseUrl?: string }>();
		const connectionString = getConnectionString(parentOpts);
		const migrationsDir = resolveSource(opts.source);

		try {
			const infos = await getMigrationInfo(connectionString, migrationsDir);

			if (infos.length === 0) {
				console.log("[migrate] No migrations found.");
				return;
			}

			const versionWidth = 20;
			const descWidth = 30;
			const typeWidth = 7;
			const statusWidth = 10;

			const header = `${
				"Version".padEnd(versionWidth) +
				"Description".padEnd(descWidth) +
				"Type".padEnd(typeWidth) +
				"Status".padEnd(statusWidth)
			}Applied At`;

			console.log(header);
			console.log("-".repeat(header.length + 20));

			for (const info of infos) {
				const status =
					info.success === null ? "Pending" : info.success ? "Applied" : "Failed";
				const appliedAt = info.appliedAt ? formatDate(info.appliedAt) : "-";
				const desc =
					info.description.length > descWidth - 2
						? `${info.description.slice(0, descWidth - 5)}...`
						: info.description;

				console.log(
					String(info.version).padEnd(versionWidth) +
						desc.padEnd(descWidth) +
						info.type.padEnd(typeWidth) +
						status.padEnd(statusWidth) +
						appliedAt,
				);
			}
		} catch (err) {
			console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

program.parse();
