import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import { log } from "#lib/log/log";
import {
	FervidexStyleRequireNotGuest,
	RequireNotGuest,
	SetFervidexStyleRequestPermissions,
	SetRequestPermissions,
} from "#server/middleware/auth";
import { RequireBokutachi, RequireKamaitachi } from "#server/middleware/type-require";
import { FormatUserDoc, GetUserWithID } from "#utils/user";
import { Router } from "express";

import barbatosIR from "./barbatos/router";
import beatorajaIR from "./beatoraja/router";
import directManualIR from "./direct-manual/router";
import fervidexIR from "./fervidex/router";
import ksHookIR from "./kshook/router";
import lr2hookIR from "./lr2hook/router";
import uscIR from "./usc/router";

const router: Router = Router({ mergeParams: true });

router.use(async (req, res, next) => {
	if (!req[SYMBOL_TACHI_API_AUTH]) {
		log.debug(
			{
				body: req.body,
				query: req.query,
				url: req.url,
			},
			`IR import request received from: ${req.header("Authorization")}`,
		);

		next();
		return;
	}

	let user;

	if (req[SYMBOL_TACHI_API_AUTH].userID) {
		user = await GetUserWithID(req[SYMBOL_TACHI_API_AUTH].userID);
	} else {
		user = null;
	}

	log.debug(
		{
			user,
			body: req.body,
			query: req.query,
			url: req.url,
		},
		`IR import request received from: ${user ? FormatUserDoc(user) : "Unknown"}`,
	);

	next();
});

// Common IRs

router.use("/direct-manual", SetRequestPermissions, RequireNotGuest, directManualIR);

// Bokutachi IRs

// note: this is the only IR that cannot use SetRequestPermissions for its
// auth, because the USCIR spec requires a different set of response
// codes for auth.
router.use("/usc", RequireBokutachi, uscIR);
router.use("/beatoraja", SetRequestPermissions, RequireNotGuest, RequireBokutachi, beatorajaIR);
router.use("/lr2hook", SetRequestPermissions, RequireNotGuest, RequireBokutachi, lr2hookIR);

// Kamaitachi IRs

router.use(
	"/kshook",
	RequireKamaitachi,
	SetFervidexStyleRequestPermissions,
	FervidexStyleRequireNotGuest,
	ksHookIR,
);
router.use("/barbatos", SetRequestPermissions, RequireNotGuest, RequireKamaitachi, barbatosIR);
router.use(
	"/fervidex",
	SetFervidexStyleRequestPermissions,
	FervidexStyleRequireNotGuest,
	RequireKamaitachi,
	fervidexIR,
);

export default router;
