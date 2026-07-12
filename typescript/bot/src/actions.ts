import db from "#services/pg/db";
import { type ActionTaker, type AnonActionTaker, MakeActionGuts } from "bliss";
import { type ActionSignature } from "bliss/actions";
import { type GuildMember } from "discord.js";
import { z } from "zod";

const APP_NAME = "TACHI_BOT";

export type ActionName = keyof typeof ActionSignatures;
export type AnonActionName = keyof typeof AnonActionSignatures;

export const ActionSignatures = {
	SYNC: {
		input: z.object({
			import_type: z.string(),
			"!api_token": z.string(),
		}),
		output: z.object({
			import_id: z.string(),
			score_count: z.number().int(),
			session_count: z.number().int(),
			error_count: z.number().int(),
			user_id: z.number().int(),
			games: z.string().array(),
		}),
	},
} satisfies Record<string, ActionSignature>;

export const AnonActionSignatures = {
	REGISTER: {
		input: z.object({
			user_id: z.number().int(),
			discord_id: z.string(),
			"!api_token": z.string(),
		}),
		output: z.object({ was_update: z.boolean() }),
	},
	LETMEIN: {
		input: z.object({
			discord_user_id: z.string(),
			role_id: z.string(),
			"!member": z.custom<GuildMember>(),
		}),
		output: z.object({}),
	},
} satisfies Record<string, ActionSignature>;

/**
 * Wrap a function in all of the things that make it an action, but this is an action where the user initiating it is not necessarily known.
 */
export function MakeAnonAction<A extends AnonActionName>(
	kind: A,
	fn: AnonActionFn<A>,
): AnonActionFn<A> {
	return MakeActionGuts({
		db,
		appName: APP_NAME,
		kind,
		inputSchema: AnonActionSignatures[kind].input,
		outputSchema: AnonActionSignatures[kind].output,
		// @ts-expect-error we're being creative with the types here
		fn,
	}) as AnonActionFn<A>;
}

/**
 * Wrap a function in all of the things that make it an action, including audit logging
 * to the action table.
 */
export function MakeAction<A extends ActionName>(kind: A, fn: ActionFn<A>): ActionFn<A> {
	return MakeActionGuts({
		db,
		appName: APP_NAME,
		kind,
		inputSchema: ActionSignatures[kind].input,
		outputSchema: ActionSignatures[kind].output,
		// @ts-expect-error we're being creative with the types here
		fn,
	}) as ActionFn<A>;
}

type ActionFn<A extends ActionName> = (
	actionTaker: ActionTaker,
	input: z.infer<(typeof ActionSignatures)[A]["input"]>,
) => Promise<z.infer<(typeof ActionSignatures)[A]["output"]>>;

type AnonActionFn<A extends AnonActionName> = (
	actionTaker: AnonActionTaker,
	input: z.infer<(typeof AnonActionSignatures)[A]["input"]>,
) => Promise<z.infer<(typeof AnonActionSignatures)[A]["output"]>>;
