/**
 * Run an authenticated server action as a given user (dev / ops).
 *
 * Requires POSTGRES_URL (same as server). Loads `.env` from the server package.
 *
 * Payload must be JSON. Keys can include "!" prefixes (e.g. "!password").
 * Actions that require Buffer input (CHANGE_PFP, CHANGE_BANNER, …) are not
 * supported here—use the API or a dedicated script.
 *
 * Usage:
 *   bun run src/scripts/run-action.ts -- --user-id 1 --action UPSERT_KAI_AUTH_TOKEN \
 *     --payload '{"service":"EAG","token":"...","refreshToken":"..."}'
 *
 *   bun run src/scripts/run-action.ts -- --user-id 1 --action SCORE_IMPORT \
 *     --payload-file ./payload.json
 *
 *   bun run src/scripts/run-action.ts -- --help
 */
import "dotenv/config";

import type { ActionName } from "#lib/actions/actions";

import {
	type AuthenticatedActionHandler,
	authenticatedActionHandlers,
} from "#lib/actions/authenticated-action-handlers";
import DB from "#services/pg/db";
import { type ActionTaker, ExpectedErr } from "bliss";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

function printHelp(): void {
	console.log(`
run-action — invoke a logged-in (authenticated) action as a user

  --user-id <n>        Account id (required)
  --action <NAME>      One of: ${Object.keys(authenticatedActionHandlers).sort().join(", ")}
  --payload '<json>'   JSON object (default {})
  --payload-file <p>   Read JSON from file (overrides --payload)
  -h, --help           Show this help

Environment: POSTGRES_URL (required), same as tachi-server.
`);
}

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			"user-id": { type: "string" },
			action: { type: "string" },
			payload: { type: "string" },
			"payload-file": { type: "string" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
	});

	if (values.help || positionals.includes("help")) {
		printHelp();
		process.exit(0);
	}

	const userIdRaw = values["user-id"];
	const actionName = values.action;

	if (!userIdRaw || !actionName) {
		printHelp();
		process.exit(1);
	}

	const userId = Number(userIdRaw);
	if (!Number.isInteger(userId) || userId < 1) {
		console.error("run-action: --user-id must be a positive integer.");
		process.exit(1);
	}

	if (!Object.hasOwn(authenticatedActionHandlers, actionName)) {
		console.error(`run-action: unknown action "${actionName}". Use --help for the list.`);
		process.exit(1);
	}

	const handler = authenticatedActionHandlers[
		actionName as ActionName
	] as AuthenticatedActionHandler;

	let payload: Record<string, unknown> = {};
	if (values["payload-file"]) {
		const raw = readFileSync(values["payload-file"], "utf8");
		payload = JSON.parse(raw) as Record<string, unknown>;
	} else if (values.payload !== undefined) {
		const raw = values.payload.trim() === "" ? "{}" : values.payload;
		payload = JSON.parse(raw) as Record<string, unknown>;
	}

	const row = await DB.selectFrom("account")
		.select(["account.username"])
		.where("account.id", "=", userId)
		.executeTakeFirst();

	if (!row) {
		console.error(`run-action: no account with id ${userId}.`);
		process.exit(1);
	}

	const taker: ActionTaker = {
		ip: null,
		acct: { id: userId, username: row.username },
	};

	try {
		const out = await handler(taker, payload);
		console.log(JSON.stringify(out ?? {}, null, 2));
	} catch (e) {
		if (ExpectedErr.is(e)) {
			console.error(`run-action: ExpectedErr ${e.code}: ${e.reason}`);
			process.exit(1);
		}
		throw e;
	}
}

await main();
