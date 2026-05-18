/**
 * MYT gRPC probe: unary Cards.Lookup vs server-streaming GetPlaylog.
 *
 * Run inside the server container (same env as prod):
 *
 *   cd /app/typescript/server
 *   bun run src/scripts/myt-grpc-probe.ts -- --profile-api-id "<title_api_id>" --game chunithm
 *   bun run src/scripts/myt-grpc-probe.ts -- --access-code "..." --game chunithm
 *
 * Env (required): TACHI_MYT_API_HOST, TACHI_MYT_AUTH_TOKEN
 *
 * Exit 0 only if every requested phase succeeds.
 */
import { Cards, LookupRequestSchema } from "#proto/generated/cards/cards_pb";
import { ChunithmUser, GetPlaylogRequestSchema } from "#proto/generated/chunithm/user_pb";
import {
	GetPlaylogRequestSchema as MaimaiGetPlaylogRequestSchema,
	MaimaiUser,
} from "#proto/generated/maimai/user_pb";
import {
	GetPlaylogRequestSchema as OngekiGetPlaylogRequestSchema,
	OngekiUser,
} from "#proto/generated/ongeki/user_pb";
import { PlaylogRequestSchema, WaccaUser } from "#proto/generated/wacca/user_pb";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, createClient, type Transport } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

type ProbeGame = "chunithm" | "maimaidx" | "ongeki" | "wacca";

const MYT_TITLE: Record<ProbeGame, string> = {
	chunithm: "chunithm",
	maimaidx: "maimai",
	ongeki: "ongeki",
	wacca: "wacca",
};

function log(section: string, message: string, extra?: Record<string, unknown>): void {
	const prefix = `[myt-probe:${section}]`;
	if (extra === undefined) {
		console.log(`${prefix} ${message}`);
	} else {
		console.log(`${prefix} ${message}`, JSON.stringify(extra, null, 2));
	}
}

function fail(message: string): never {
	console.error(`[myt-probe] ERROR: ${message}`);
	process.exit(1);
}

function requireEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		fail(`Missing env ${name}`);
	}
	return value;
}

function createTransport(): Transport {
	const host = requireEnv("TACHI_MYT_API_HOST");
	const token = requireEnv("TACHI_MYT_AUTH_TOKEN");

	return createGrpcTransport({
		baseUrl: `https://${host}`,
		defaultTimeoutMs: 10 * 60 * 1000,
		interceptors: [
			(next) => async (req) => {
				req.header.set("Authorization", `Bearer ${token}`);
				return next(req);
			},
		],
	});
}

function connectCodeName(code: Code): string {
	return Code[code] ?? String(code);
}

function formatConnectError(err: ConnectError): Record<string, unknown> {
	return {
		message: err.message,
		rawMessage: err.rawMessage,
		code: err.code,
		codeName: connectCodeName(err.code),
		metadata: Object.fromEntries(err.metadata.entries()),
		cause:
			err.cause instanceof Error
				? { name: err.cause.name, message: err.cause.message, stack: err.cause.stack }
				: err.cause,
	};
}

async function probeLookup(
	transport: Transport,
	accessCode: string,
	game: ProbeGame,
): Promise<string> {
	const client = createClient(Cards, transport);
	const title = MYT_TITLE[game];
	const started = performance.now();

	log("lookup", `Cards.Lookup titles=[${title}] ...`);

	try {
		const response = await client.lookup(
			create(LookupRequestSchema, { accessCode, titles: [title] }),
		);

		for (const entry of response.titles) {
			if (entry.titleKind === title) {
				const ms = Math.round(performance.now() - started);
				log("lookup", `OK in ${ms}ms`, {
					playerApiId: response.playerApiId,
					titleApiId: entry.titleApiId,
					titleKind: entry.titleKind,
				});
				return entry.titleApiId;
			}
		}

		fail(`Lookup succeeded but no title "${title}" in response`);
	} catch (err) {
		const ms = Math.round(performance.now() - started);
		if (err instanceof ConnectError) {
			log("lookup", `FAILED after ${ms}ms`, formatConnectError(err));
		} else {
			log("lookup", `FAILED after ${ms}ms`, { err: String(err) });
		}
		throw err;
	}
}

async function probeGetPlaylog(
	transport: Transport,
	profileApiId: string,
	game: ProbeGame,
	maxItems: number,
): Promise<number> {
	const started = performance.now();
	let count = 0;
	let firstItemMs: number | undefined;

	log("stream", `GetPlaylog (max ${maxItems} items) profileApiId=${profileApiId} ...`);

	const stream = createPlaylogStream(transport, profileApiId, game);

	try {
		for await (const item of stream) {
			count++;
			if (firstItemMs === undefined) {
				firstItemMs = Math.round(performance.now() - started);
				log("stream", `First item after ${firstItemMs}ms`, { sample: summarizeItem(item) });
			}

			if (count >= maxItems) {
				log("stream", `Stopping after ${count} item(s) (--max-items)`);
				break;
			}
		}

		const ms = Math.round(performance.now() - started);
		log("stream", `OK — received ${count} item(s) in ${ms}ms`, {
			firstItemMs: firstItemMs ?? null,
		});
		return count;
	} catch (err) {
		const ms = Math.round(performance.now() - started);
		if (err instanceof ConnectError) {
			log(
				"stream",
				`FAILED after ${ms}ms (${count} item(s) before error)`,
				formatConnectError(err),
			);
		} else {
			log("stream", `FAILED after ${ms}ms (${count} item(s) before error)`, {
				err: String(err),
			});
		}
		throw err;
	}
}

function summarizeItem(item: unknown): Record<string, unknown> {
	if (item === null || typeof item !== "object") {
		return { type: typeof item };
	}

	const record = item as Record<string, unknown>;
	const summary: Record<string, unknown> = {};
	if ("playlogApiId" in record) {
		summary.playlogApiId = record.playlogApiId;
	}
	if ("info" in record && record.info !== undefined) {
		summary.hasInfo = true;
	}
	if ("judge" in record && record.judge !== undefined) {
		summary.hasJudge = true;
	}
	return summary;
}

function createPlaylogStream(
	transport: Transport,
	profileApiId: string,
	game: ProbeGame,
): AsyncIterable<unknown> {
	switch (game) {
		case "chunithm": {
			const client = createClient(ChunithmUser, transport);
			return client.getPlaylog(create(GetPlaylogRequestSchema, { profileApiId }));
		}
		case "maimaidx": {
			const client = createClient(MaimaiUser, transport);
			return client.getPlaylog(create(MaimaiGetPlaylogRequestSchema, { profileApiId }));
		}
		case "ongeki": {
			const client = createClient(OngekiUser, transport);
			return client.getPlaylog(create(OngekiGetPlaylogRequestSchema, { profileApiId }));
		}
		case "wacca": {
			const client = createClient(WaccaUser, transport);
			return client.getPlaylog(create(PlaylogRequestSchema, { apiId: profileApiId }));
		}
		default: {
			const _exhaustive: never = game;
			return _exhaustive;
		}
	}
}

function printRuntimeInfo(): void {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	log("env", `Bun ${Bun.version}`);
	log("env", `TACHI_MYT_API_HOST=${requireEnv("TACHI_MYT_API_HOST")}`);

	const node = spawnSync("node", ["--version"], { encoding: "utf8" });
	if (node.status === 0 && node.stdout.trim()) {
		log("env", `Node ${node.stdout.trim()} (available for manual A/B vs bun)`);
	} else {
		log("env", "Node not on PATH — streaming A/B needs a Node binary in the image");
	}
}

function printHelp(): void {
	console.log(`
myt-grpc-probe — test MYT unary Lookup vs streaming GetPlaylog

  --profile-api-id <id>   Title API id (from Lookup or MYT admin)
  --access-code <code>    Card access code (runs Lookup first)
  --game <name>           chunithm | maimaidx | ongeki | wacca  (default: chunithm)
  --max-items <n>         Stop stream after N items (default: 5)
  --lookup-only           Skip GetPlaylog
  --stream-only           Skip Lookup (requires --profile-api-id)
  -h, --help

Examples (inside container):

  cd /app/typescript/server
  bun run src/scripts/myt-grpc-probe.ts -- --access-code "YOUR_CODE" --game chunithm
  bun run src/scripts/myt-grpc-probe.ts -- --profile-api-id "abc123" --max-items 1
`);
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			"profile-api-id": { type: "string" },
			"access-code": { type: "string" },
			game: { type: "string", default: "chunithm" },
			"max-items": { type: "string", default: "5" },
			"lookup-only": { type: "boolean", default: false },
			"stream-only": { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
		allowPositionals: false,
	});

	if (values.help) {
		printHelp();
		return;
	}

	const game = values.game as ProbeGame;
	if (!(game in MYT_TITLE)) {
		fail(`Unknown --game ${values.game}; use chunithm, maimaidx, ongeki, or wacca`);
	}

	const maxItems = Number.parseInt(values["max-items"] ?? "5", 10);
	if (!Number.isFinite(maxItems) || maxItems < 1) {
		fail("--max-items must be a positive integer");
	}

	printRuntimeInfo();

	const transport = createTransport();
	let profileApiId = values["profile-api-id"]?.trim();

	if (!values["stream-only"] && values["access-code"]) {
		profileApiId = await probeLookup(transport, values["access-code"].trim(), game);
		if (values["lookup-only"]) {
			log("done", "Lookup-only mode — exit 0");
			return;
		}
	}

	if (values["lookup-only"]) {
		if (!values["access-code"]) {
			fail("--lookup-only requires --access-code");
		}
		return;
	}

	if (!profileApiId) {
		fail("Need --profile-api-id or --access-code for GetPlaylog");
	}

	await probeGetPlaylog(transport, profileApiId, game, maxItems);
	log("done", "All phases OK — exit 0");
}

main().catch(() => {
	process.exit(1);
});
