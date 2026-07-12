import type { Database } from "tachi-db";

import { Env } from "#config";
import { Kysely, PostgresDialect } from "kysely";
import pg, { Pool } from "pg";

// pg returns BIGINT/BIGSERIAL (OID 20) as strings by default to avoid
// precision loss for very large values. Our IDs are well within Number.MAX_SAFE_INTEGER,
// so parse them as numbers to keep types consistent across the codebase.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => val);
pg.types.setTypeParser(pg.types.builtins.INT4, (val) => Number(val));
pg.types.setTypeParser(pg.types.builtins.INT2, (val) => Number(val));
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => Number(val));

const pool = new Pool({ connectionString: Env.POSTGRES_URL });

const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});

export async function ClosePgConnection() {
	await db.destroy();
}

export default db;
