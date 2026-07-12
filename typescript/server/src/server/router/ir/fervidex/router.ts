import { MODEL_INFINITAS_2, REV_2DXBMS } from "#lib/constants/ea3id";
import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import { ExpressWrappedScoreImportMain } from "#lib/score-import/framework/express-wrapper";
import { SoftwareIDToVersion } from "#lib/score-import/import-types/ir/fervidex/parser";
import { RequirePermissions } from "#server/middleware/auth";
import { PrudenceErrorFormatter } from "#server/middleware/prudence-validate";
import DB from "#services/pg/db";
import { UpdateClassIfGreater } from "#utils/class";
import { ParseEA3SoftID } from "#utils/ea3id";
import { IsNullishOrEmptyStr } from "#utils/misc";
import { type RequestHandler, Router } from "express";
import { p } from "prudence";
import {
	type GamesForGroup,
	GetGameConfig,
	type integer,
	type SpecificGameConfig,
} from "tachi-common";

const router: Router = Router({ mergeParams: true });

const ValidateFervidexHeader: RequestHandler = (req, res, next) => {
	const agent = req.header("User-Agent");

	if (IsNullishOrEmptyStr(agent)) {
		log.debug(
			`Rejected fervidex client with no agent from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent.`,
		});
	}

	if (!agent.startsWith("fervidex/")) {
		log.info(
			`Rejected fervidex client with invalid agent ${agent} from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent ${agent} - expected fervidex client.`,
		});
	}

	const versions = agent.split("fervidex/")[1]!.split(".").map(Number);

	if (!versions.every((e) => !Number.isNaN(e)) || versions.length < 3) {
		log.info(
			`Rejected fervidex client with agent ${agent} for NaN-like versions from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid version ${versions.join(".")}.`,
		});
	}

	// version.minor
	// asserted to exist based on versions.length being greater than 3.
	if (versions[0] === 1 && versions[1]! < 3) {
		log.debug(
			`Rejected outdated fervidex client from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Versions of fervidex < 1.3.0 are not supported.`,
		});
	}

	next();
};

const ValidateModelHeader: RequestHandler = (req, res, next) => {
	const swModel = req.header("X-Software-Model");

	if (IsNullishOrEmptyStr(swModel)) {
		log.debug(
			`Rejected empty X-Software Model from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
		);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	try {
		const softID = ParseEA3SoftID(swModel);

		if (softID.rev === REV_2DXBMS) {
			return res.status(400).send({
				success: false,
				error: "2DX_BMS is not supported.",
			});
		}

		if (softID.model === MODEL_INFINITAS_2) {
			// allow anything for inf2.
			next();
			return;
		}

		try {
			SoftwareIDToVersion(swModel, log);
		} catch (err) {
			log.info(
				{ err },
				`Rejected invalid Software Model ${swModel} from user ${req[SYMBOL_TACHI_API_AUTH].userID}.`,
			);
			return res.status(400).json({
				success: false,
				error: `Invalid software model ${swModel})`,
			});
		}
	} catch (err) {
		log.debug(err);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	next();
};

const ValidateCards: RequestHandler = async (req, res, next) => {
	const userID = req[SYMBOL_TACHI_API_AUTH].userID!;

	const cardRows = await DB.selectFrom("priv_svc_fer_card")
		.select("priv_svc_fer_card.card_id")
		.where("user_id", "=", userID)
		.execute();

	if (cardRows.length === 0) {
		next();
		return;
	}

	const allowedCards = cardRows.map((r) => r.card_id);
	const cardID = req.header("X-Account-Id");

	if (IsNullishOrEmptyStr(cardID)) {
		return res.status(400).json({
			success: false,
			error: `Fervidex did not provide a card ID.`,
		});
	}

	if (!allowedCards.includes(cardID)) {
		return res.status(400).json({
			success: false,
			error: `The card ID ${cardID} is not in your list of filters. Ignoring.`,
		});
	}

	next();
};

router.use(
	RequirePermissions("submit_score"),
	ValidateFervidexHeader,
	ValidateModelHeader,
	ValidateCards,
);

async function ShouldImportScoresFromProfileSubmit(swModel: string, userID: integer) {
	const row = await DB.selectFrom("svc_fer_settings")
		.select(["svc_fer_settings.force_static_import"])
		.where("user_id", "=", userID)
		.executeTakeFirst();

	if (row?.force_static_import === true) {
		log.debug(`User ${userID} had forceStaticImport set, allowing request.`);

		// Force static import should ideally only ever be used once. If left on, a users profile
		// will get innundated with a bunch of pb imports on every game-load. This is not what
		// people want.
		// FSI should ideally just be used once to get unreachable scores onto Kamaitachi. Otherwise
		// they're doing something wrong.
		await DB.insertInto("svc_fer_settings")
			.values({ user_id: userID, force_static_import: false })
			.onConflict((oc) => oc.column("user_id").doUpdateSet({ force_static_import: false }))
			.execute();

		return true;
	}

	try {
		const { model } = ParseEA3SoftID(swModel);

		return model === MODEL_INFINITAS_2;
	} catch (err) {
		log.warn(
			{
				err,
			},
			`Unexpected fail while parsing swModel ${swModel}, has already been validated?.`,
		);

		// try some good-natured attempt to recover, since this isn't that severe of an
		// issue.
		return false;
	}
}

/**
 * Submits all of a users data to Tachi. This data is extremely minimal,
 * as only a users Lamp and Score are sent. As such, this is not the prefered
 * way of syncing scores outside of INF2, where there is no other way to
 * retrieve scores.
 *
 * @name POST /ir/fervidex/profile/submit
 */
router.post("/profile/submit", async (req, res) => {
	// guaranteed to exist because of RequireInf2ModelHeader
	const model = req.header("X-Software-Model")!;

	const shouldImportScores = await ShouldImportScoresFromProfileSubmit(
		model,
		req[SYMBOL_TACHI_API_AUTH].userID!,
	);

	const headers = {
		model,
		shouldImportScores,
	};

	// Perform a fast return here to not allow fervidex to resend requests.
	res.status(202).json({
		success: true,
		description: `Your import has been loaded for further processing.`,
		body: {},
	});

	void ExpressWrappedScoreImportMain(
		req[SYMBOL_TACHI_API_AUTH].userID!,
		false,
		"ir/fervidex-static",
		[req.safeBody, headers],
	);
});

/**
 * Submits a single score to Tachi. In contrast to profile/submit, this
 * sends the most data (and most accurate data) of any score hook.
 * As such, this is the preferred way of submitting IIDX scores to Tachi.
 *
 * @name POST /ir/fervidex/score/submit
 */
router.post("/score/submit", ValidateModelHeader, async (req, res) => {
	const model = req.header("X-Software-Model");

	if (IsNullishOrEmptyStr(model)) {
		return res.status(400).json({
			success: false,
			error: "No X-Software-Model header provided?",
		});
	}

	const headers = {
		model,
	};

	const responseData = await ExpressWrappedScoreImportMain(
		req[SYMBOL_TACHI_API_AUTH].userID!,
		false,
		"ir/fervidex",
		[req.safeBody, headers, req[SYMBOL_TACHI_API_AUTH].userID!],
	);

	if (!responseData.body.success) {
		// in-air rewrite description to error.
		// @ts-expect-error Hack!
		responseData.body.error = responseData.body.description;

		// @ts-expect-error Hack!
		delete responseData.body.description;
	}

	return res.status(responseData.statusCode).json(responseData.body);
});

/**
 * Submits the result of a class to Tachi. This contains the dan played
 * and whether it was achieved.
 *
 * @name POST /ir/fervidex/class/submit
 */
router.post("/class/submit", ValidateModelHeader, async (req, res) => {
	// This is done here, instead of in prValidate, as we need to return using
	// a different key.
	const err = p(
		req.body,
		{
			cleared: "boolean",
			course_id: p.isBoundedInteger(0, 18),
			play_style: p.isIn(0, 1),
		},
		{},
		{ allowExcessKeys: true },
	);

	if (err) {
		return res.status(400).json({
			success: false,
			error: PrudenceErrorFormatter(err.message, String(err.userVal), err.keychain),
		});
	}

	const body = req.safeBody as {
		cleared: boolean;
		course_id: integer;
		play_style: 0 | 1;
	};

	if (!body.cleared) {
		return res.status(200).json({ success: true, description: "No Update Made.", body: {} });
	}

	// is 0 or 1.
	const game: GamesForGroup["iidx"] = body.play_style === 0 ? "iidx-sp" : "iidx-dp";

	const dans = (GetGameConfig(game) as unknown as SpecificGameConfig<GamesForGroup["iidx"]>)
		.classes.dan.values;

	const dan = dans[body.course_id];

	if (dan === undefined) {
		return res.status(400).json({
			success: false,
			description: `Unknown course_id ${body.course_id}.`,
		});
	}

	const r = await UpdateClassIfGreater(req[SYMBOL_TACHI_API_AUTH].userID!, game, "dan", dan.id);

	return res.status(200).json({
		success: true,
		description:
			r === false ? "Dan unchanged, was worse than your current dan." : "Dan changed!",
	});
});

export default router;
