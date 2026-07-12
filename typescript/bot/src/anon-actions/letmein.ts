import { MakeAnonAction } from "../actions";

export const ANON_ACTION_Letmein = MakeAnonAction(
	"LETMEIN",
	async (_taker, { role_id, "!member": member }) => {
		await member.roles.add(role_id);

		return {};
	},
);
