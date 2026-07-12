import { ISO8601ToUnixMilliseconds } from "#utils/time";
import { type Selection } from "kysely";
import { type InviteCodeDocument } from "tachi-common";
import { type Database } from "tachi-db";

export const SELECT_INVITE = [
	"priv_invite.code",
	"priv_invite.created_by",
	"priv_invite.created_at",
	"priv_invite.consumed",
	"priv_invite.consumed_by",
	"priv_invite.consumed_at",
] as const;

export function ToInviteDocument(
	row: Selection<Database, "priv_invite", (typeof SELECT_INVITE)[number]>,
): InviteCodeDocument {
	const base = {
		code: row.code,
		createdBy: row.created_by,
		createdAt: ISO8601ToUnixMilliseconds(row.created_at),
	};

	if (row.consumed) {
		return {
			...base,
			consumed: true,
			consumedAt: ISO8601ToUnixMilliseconds(row.consumed_at!),
			consumedBy: row.consumed_by!,
		};
	}

	return {
		...base,

		consumed: false,
		consumedAt: null,
		consumedBy: null,
	};
}
