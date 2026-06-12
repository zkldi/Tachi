import { MakeAction } from "#lib/actions/actions";
import { SetRivalsFailReasons } from "#lib/constants/err-codes";
import { setRivalsWithResult } from "#lib/rivals/rivals";
import { staticAssertUnreachable } from "#utils/misc";
import { IsUserAdmin } from "#utils/user";
import { ExpectedErr } from "bliss";
import { type V3Game } from "tachi-common";

function throwIfSetRivalsFailed(game: V3Game, reason: SetRivalsFailReasons): never {
	switch (reason) {
		case SetRivalsFailReasons.RIVALED_SELF:
			throw new ExpectedErr(400, `You cannot rival yourself.`);
		case SetRivalsFailReasons.RIVALS_HAVENT_PLAYED_GAME:
			throw new ExpectedErr(400, `Not all of the rivals you specified have played ${game}.`);
		case SetRivalsFailReasons.TOO_MANY:
			throw new ExpectedErr(400, `You can't set more than 5 rivals.`);
		default:
			staticAssertUnreachable(reason);
	}
}

export const ACTION_SetRivals = MakeAction("SET_RIVALS", async (taker, input) => {
	const { userID, game, rivalIDs } = input;

	if (taker.acct.id !== userID && !(await IsUserAdmin(taker.acct.id))) {
		throw new ExpectedErr(403, "You are not authorised to modify this user's rivals.");
	}

	const err = await setRivalsWithResult(userID, game, rivalIDs);
	if (err !== null) {
		throwIfSetRivalsFailed(game, err);
	}

	return {};
});
