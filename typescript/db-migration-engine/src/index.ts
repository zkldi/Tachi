import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
/* eslint-disable no-await-in-loop */
import { Client } from "pg";

type MigrationFileType = "down" | "plain" | "up";

interface MigrationRecord {
	version: string; // pg returns BIGINT as string
	description: string;
	installed_on: Date;
	success: boolean;
	checksum: Buffer;
	execution_time: string;
}

interface MigrationFile {
	version: bigint;
	description: string;
	filename: string;
	type: MigrationFileType;
	sql: string;
	checksum: Buffer;
}

export interface MigrationInfo {
	type: "plain" | "up";
	version: bigint;
	description: string;
	filename: string;
	downFile: string | null;
	appliedAt: Date | null;
	success: boolean | null;
	executionTimeUs: bigint | null;
}

function sha256(content: string): Buffer {
	return createHash("sha256").update(content, "utf8").digest();
}

function parseMigrationFilename(
	filename: string,
): { description: string; type: MigrationFileType; version: bigint } | null {
	const upMatch = /^(\d+)_(.+)\.up\.sql$/u.exec(filename);

	if (upMatch?.[1] && upMatch[2]) {
		return { description: upMatch[2], type: "up", version: BigInt(upMatch[1]) };
	}

	const downMatch = /^(\d+)_(.+)\.down\.sql$/u.exec(filename);

	if (downMatch?.[1] && downMatch[2]) {
		return { description: downMatch[2], type: "down", version: BigInt(downMatch[1]) };
	}

	const plainMatch = /^(\d+)_(.+)\.sql$/u.exec(filename);

	if (plainMatch?.[1] && plainMatch[2]) {
		return { description: plainMatch[2], type: "plain", version: BigInt(plainMatch[1]) };
	}

	return null;
}

async function ensureMigrationTable(client: Client): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS "_migration" (
			version        BIGINT      NOT NULL,
			description    TEXT        NOT NULL,
			installed_on   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			success        BOOLEAN     NOT NULL,
			checksum       BYTEA       NOT NULL,
			execution_time BIGINT      NOT NULL
		)
	`);
}

async function loadAppliedMigrations(client: Client): Promise<Map<bigint, MigrationRecord>> {
	const result = await client.query<MigrationRecord>(
		`SELECT version, description, installed_on, success, checksum, execution_time
		 FROM "_migration"
		 ORDER BY version`,
	);

	const map = new Map<bigint, MigrationRecord>();

	for (const row of result.rows) {
		map.set(BigInt(row.version), row);
	}

	return map;
}

/**
 * Loads migration files eligible to be run (plain .sql and .up.sql). Skips .down.sql files.
 * Files are returned sorted lexicographically by filename (version number padding matters).
 */
function loadMigrationFiles(migrationsDir: string): Array<MigrationFile> {
	const files = readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort((a, b) => a.localeCompare(b));

	const migrations: Array<MigrationFile> = [];

	for (const filename of files) {
		const parsed = parseMigrationFilename(filename);

		if (!parsed) {
			console.warn(`[migrate] Skipping unrecognized file: ${filename}`);
			continue;
		}

		if (parsed.type === "down") {
			continue;
		}

		const sql = readFileSync(join(migrationsDir, filename), "utf8");

		migrations.push({
			...parsed,
			filename,
			sql,
			checksum: sha256(sql),
		});
	}

	return migrations;
}

const ADVISORY_LOCK = 7461636869;

async function withAdvisoryLock<T>(client: Client, fn: () => Promise<T>): Promise<T> {
	await client.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK})`);

	try {
		return await fn();
	} finally {
		await client.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK})`).catch(() => undefined);
	}
}

/**
 * Apply all pending migrations from migrationsDir against the given connection.
 * Safe to call on every startup - already-applied migrations are skipped.
 * Throws if a previously-applied migration's file has been modified (checksum mismatch).
 */
export async function applyMigrations(
	connectionString: string,
	migrationsDir: string,
): Promise<void> {
	const client = new Client({ connectionString });

	await client.connect();

	try {
		await withAdvisoryLock(client, async () => {
			await ensureMigrationTable(client);

			const applied = await loadAppliedMigrations(client);
			const migrations = loadMigrationFiles(migrationsDir);

			let appliedCount = 0;
			let skippedCount = 0;

			for (const migration of migrations) {
				const record = applied.get(migration.version);

				if (record) {
					if (record.success) {
						if (!record.checksum.equals(migration.checksum)) {
							throw new Error(
								`Checksum mismatch for migration ${migration.version} ("${migration.description}"). ` +
									`The file has been modified after it was applied. ` +
									`Refusing to continue.`,
							);
						}

						skippedCount++;
						continue;
					}

					// Previously attempted and failed - clear the record and retry.
					await client.query(
						`DELETE FROM "_migration" WHERE version = $1 AND success = false`,
						[migration.version],
					);
				}

				console.log(
					`[migrate] Applying ${migration.version} - ${migration.description}...`,
				);

				const start = process.hrtime.bigint();

				try {
					await client.query("BEGIN");
					await client.query(migration.sql);

					const elapsedUs = (process.hrtime.bigint() - start) / 1000n;

					await client.query(
						`INSERT INTO "_migration" (version, description, installed_on, success, checksum, execution_time)
						 VALUES ($1, $2, NOW(), true, $3, $4)`,
						[migration.version, migration.description, migration.checksum, elapsedUs],
					);

					await client.query("COMMIT");

					console.log(`[migrate]   ✓ Applied in ${elapsedUs}µs`);
					appliedCount++;
				} catch (err) {
					await client.query("ROLLBACK");

					const elapsedUs = (process.hrtime.bigint() - start) / 1000n;

					// Record the failure outside the rolled-back transaction.
					await client.query(
						`INSERT INTO "_migration" (version, description, installed_on, success, checksum, execution_time)
						 VALUES ($1, $2, NOW(), false, $3, $4)`,
						[migration.version, migration.description, migration.checksum, elapsedUs],
					);

					throw new Error(
						`Migration ${migration.version} ("${migration.description}") failed: ${err}`,
					);
				}
			}

			console.log(
				`[migrate] Done. Applied: ${appliedCount}, Skipped (already up-to-date): ${skippedCount}.`,
			);
		});
	} finally {
		await client.end();
	}
}

/**
 * Returns a list of all migrations (from disk) merged with their applied status from the DB.
 * Migrations are returned in ascending version order.
 */
export async function getMigrationInfo(
	connectionString: string,
	migrationsDir: string,
): Promise<MigrationInfo[]> {
	const client = new Client({ connectionString });

	await client.connect();

	try {
		await ensureMigrationTable(client);

		const applied = await loadAppliedMigrations(client);
		const migrations = loadMigrationFiles(migrationsDir);

		const allFilenames = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

		return migrations.map((m) => {
			const record = applied.get(m.version);

			const downFilename = allFilenames.find((f) => {
				const p = parseMigrationFilename(f);

				return p?.version === m.version && p.type === "down";
			});

			return {
				version: m.version,
				description: m.description,
				filename: m.filename,
				type: m.type as "plain" | "up",
				downFile: downFilename ?? null,
				appliedAt: record?.installed_on ?? null,
				success: record?.success ?? null,
				executionTimeUs: record ? BigInt(record.execution_time) : null,
			};
		});
	} finally {
		await client.end();
	}
}

/**
 * Reverts the latest successfully applied migration by running its .down.sql file.
 * Throws if the latest migration has no corresponding .down.sql file.
 */
export async function revertLastMigration(
	connectionString: string,
	migrationsDir: string,
): Promise<void> {
	const client = new Client({ connectionString });

	await client.connect();

	try {
		await withAdvisoryLock(client, async () => {
			await ensureMigrationTable(client);

			const result = await client.query<MigrationRecord>(
				`SELECT version, description, installed_on, success, checksum, execution_time
				 FROM "_migration"
				 WHERE success = true
				 ORDER BY version DESC
				 LIMIT 1`,
			);

			if (result.rows.length === 0) {
				throw new Error("No applied migrations to revert.");
			}

			const latest = result.rows[0]!;
			const latestVersion = BigInt(latest.version);

			const allFilenames = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

			const downFilename = allFilenames.find((f) => {
				const p = parseMigrationFilename(f);

				return p?.version === latestVersion && p.type === "down";
			});

			if (!downFilename) {
				throw new Error(
					`Migration ${latestVersion} ("${latest.description}") has no .down.sql file. Cannot revert.`,
				);
			}

			const downPath = join(migrationsDir, downFilename);

			if (!existsSync(downPath)) {
				throw new Error(`Down migration file not found: ${downPath}`);
			}

			const downSql = readFileSync(downPath, "utf8");

			console.log(`[migrate] Reverting ${latestVersion} - ${latest.description}...`);

			const start = process.hrtime.bigint();

			await client.query("BEGIN");

			try {
				await client.query(downSql);
				await client.query(
					`DELETE FROM "_migration" WHERE version = $1 AND success = true`,
					[latestVersion],
				);
				await client.query("COMMIT");

				const elapsedUs = (process.hrtime.bigint() - start) / 1000n;

				console.log(`[migrate]   ✓ Reverted in ${elapsedUs}µs`);
			} catch (err) {
				await client.query("ROLLBACK");
				throw new Error(
					`Revert of migration ${latestVersion} ("${latest.description}") failed: ${err}`,
				);
			}
		});
	} finally {
		await client.end();
	}
}
