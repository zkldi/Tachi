/**
 * Create N local-dev users + API tokens (submit_score) for parallel score-import load tests.
 *
 * @example
 * bun run src/load-tests/seed-stress-api-tokens.ts 32 /tmp/stress-tokens.txt
 */
import { loadServerEnvFile } from "#lib/setup/load-server-env";

loadServerEnvFile(process.env.NODE_ENV === "test" ? ".env.test" : ".env");

import { seedApiToken } from "#actions/test-utils/api-tokens";
import { seedUser } from "#test-utils/pg-fixtures";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

async function main() {
	const n = Number.parseInt(process.argv[2] ?? "", 10);
	const outPath = process.argv[3];

	if (!Number.isFinite(n) || n < 1) {
		console.error(
			"Usage: bun run src/load-tests/seed-stress-api-tokens.ts <count> <output-file>",
		);
		process.exit(1);
	}
	if (!outPath) {
		console.error("Second argument must be output path for token lines.");
		process.exit(1);
	}

	const tokens: string[] = [];
	const ts = Date.now();

	for (let i = 0; i < n; i++) {
		const u = await seedUser({
			username: `stress_${ts}_${i}`,
			email: `stress_${ts}_${i}@stress.local`,
			withCredential: true,
			withSettings: true,
		});
		const tok = `st_${ts}_${i}_${randomBytes(12).toString("hex")}`;
		await seedApiToken({ token: tok, userId: u.id, submitScore: true });
		tokens.push(tok);
	}

	writeFileSync(outPath, `${tokens.join("\n")}\n`, "utf-8");
	console.error(`Wrote ${n} tokens to ${outPath}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
