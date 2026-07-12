import { type ZodObject } from "zod";

import { AppendLogCtx, log as baseLogger } from "./log";

export type ActionResult = "BAD" | "GOOD" | "THROW";

/**
 * Secret input and output fields (keys starting with "!") are stripped before logging.
 */
function OmitPrivate<O extends object>(obj: O) {
	const out: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		if (key.startsWith("!")) {
			continue;
		}
		out[key] = value;
	}

	return out;
}

export interface AcctInfo {
	username: string;
	// n.b. number in tachi, uuid in zenith?
	id: number;
}

// TODO(zk): Somehow pull this out into some sort of
// common "zk" framework - this is used by bot, server,
// zenith, etc.
export interface ActionTaker {
	acct: AcctInfo;
	ip: string | null;
}

export interface AnonActionTaker {
	ip: string | null;
}

export class ExpectedErr extends Error {
	code: number;
	reason: string;
	stamp = "EXPECTED_ERR" as const;

	constructor(code: number, reason: string) {
		super(reason);
		this.code = code;
		this.reason = reason;
	}

	static is(t: unknown): t is ExpectedErr {
		return t instanceof ExpectedErr;
	}
}

export type ActionSignature = {
	input: ZodObject;
	output: ZodObject;
};

// Make an instrumented "action function" from the
// base parts. You should write a typed abstraction
// around this.
export function MakeActionGuts({
	db,
	appName,
	kind,
	fn: actionBodyFn,
	inputSchema,
	outputSchema,
}: {
	appName: string;
	db: any;
	fn: (taker: ActionTaker | AnonActionTaker, input: object) => Promise<object>;
	inputSchema: ZodObject;
	kind: string;
	outputSchema: ZodObject;
}): unknown {
	return async (taker: ActionTaker | AnonActionTaker, input: Record<string, unknown>) => {
		const ts_start = new Date();

		const inputJSON = JSON.stringify(OmitPrivate(input));

		let result: ActionResult;
		let outputJSON = null;
		let retval;
		let err;

		const log = AppendLogCtx(kind, baseLogger);

		log.debug({ input: OmitPrivate(input) }, "Action started");

		try {
			const inputParsed = inputSchema.safeParse(input);

			if (!inputParsed.success) {
				const msg = inputParsed.error.issues
					.map((i) => `${i.path.join(".")}: ${i.message}`)
					.join("; ");
				throw new ExpectedErr(400, msg || `Action ${kind} received invalid input.`);
			}

			retval = await actionBodyFn(taker, input);

			const outputParsed = outputSchema.safeParse(retval);

			if (!outputParsed.success) {
				log.error(
					{ errors: outputParsed.error.issues, output: OmitPrivate(retval ?? {}) },
					`Action ${kind} returned invalid output`,
				);
			}

			outputJSON = JSON.stringify(OmitPrivate(retval ?? {}));
			log.debug(
				{ input: OmitPrivate(input), output: OmitPrivate(retval ?? {}) },
				`Action ${kind} succeeded`,
			);

			result = "GOOD";
		} catch (e) {
			if (ExpectedErr.is(e)) {
				log.info(
					{ code: e.code, input: OmitPrivate(input), reason: e.reason },
					`Action ${kind} failed`,
				);
				outputJSON = JSON.stringify({ code: e.code, reason: e.reason });
				result = "BAD";
			} else {
				log.error({ err: e, input: OmitPrivate(input) }, `Action ${kind} threw`);

				outputJSON = JSON.stringify({ reason: String(e) });
				result = "THROW";
			}

			err = e;
		}

		await db
			.insertInto("action")
			.values({
				app: appName,
				kind,
				user_id: "acct" in taker ? taker.acct.id : null,
				ip: taker.ip,
				input: inputJSON,
				output: outputJSON,
				result,
				ts_start: ts_start.toISOString(),
				ts_end: new Date().toISOString(),
			})
			.execute();

		if (err) {
			throw err;
		}

		return retval!;
	};
}
