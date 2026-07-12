import { applyMigrations } from ".";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
	console.error("[migrate] POSTGRES_URL environment variable is not set.");
	process.exit(1);
}

// Default to the sibling migrations directory: db/migrations/
const migrationsDir = process.env.MIGRATIONS_DIR ?? "/tachi/db/migrations";

applyMigrations(connectionString, migrationsDir).catch((err: unknown) => {
	console.error("[migrate] Fatal:", err instanceof Error ? err.message : err);
	process.exit(1);
});
