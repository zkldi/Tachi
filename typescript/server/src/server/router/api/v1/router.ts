// `API_V1_ROUTER` is the singleton route registry; it lives in `./_singleton`
// so the submodules below can import it without cycling back through this
// file (the old `await import(...)` + top-level-await scheme was the only
// way to break the previous cycle, and vitest's vite-node under `pool:
// "threads" + isolate: false` does not reliably await TLA before serving a
// module's exports to a static `import` somewhere up the tree).
import { API_V1_ROUTER } from "./_singleton";

export { API_V1_ROUTER };

// Submodules register routes on `API_V1_ROUTER` as a side effect of being
// imported. Ordering only matters where one route prefix shadows another
// (e.g. `/users/_userID` after `/users`); within a group the order below
// mirrors the original `await import(...)` block.
import "./status/router";
import "./auth/router";
import "./admin/router";
import "./import/router";
import "./imports/router";
import "./users/router";
import "./games/router";
import "./games/@gameSpecificRoutes/bms/router";
import "./games/@gameSpecificRoutes/iidx/router";
import "./search/router";
import "./sessions/router";
import "./sessions/_sessionID/router";
import "./oauth/router";
import "./clients/router";
import "./activity/router";
import "./config/router";
import "./localdev/router";
import "./seeds/router";
import "./proposals/router";
import "./scores/_scoreID/router";
import "./users/_userID/router";
import "./users/_userID/pfp/router";
import "./users/_userID/banner/router";
import "./users/_userID/api-tokens/router";
import "./users/_userID/invites/router";
import "./users/_userID/following/router";
import "./users/_userID/notifications/router";
import "./users/_userID/sessions/router";
import "./users/_userID/imports/router";
import "./users/_userID/settings/router";
import "./users/_userID/integrations/router";
import "./users/_userID/integrations/cg/_cgType/router";
import "./users/_userID/integrations/kai/_kaiType/router";
import "./users/_userID/integrations/fervidex/router";
import "./users/_userID/integrations/kshook-sv6c/router";
import "./users/_userID/integrations/myt/router";
import "./users/_userID/games/@gameSpecificRoutes/bms/router";
import "./users/_userID/games/@gameSpecificRoutes/iidx/router";
import "./users/_userID/games/@gameSpecificRoutes/jubeat/router";
import "./users/_userID/games/_game/_playtype/pbs/router";
import "./users/_userID/games/_game/_playtype/scores/router";
import "./users/_userID/games/_game/_playtype/sessions/router";
import "./users/_userID/games/_game/_playtype/tables/router";
import "./users/_userID/games/_game/_playtype/showcase/router";
import "./users/_userID/games/_game/_playtype/settings/router";
import "./users/_userID/games/_game/_playtype/targets/router";
import "./users/_userID/games/_game/_playtype/targets/goals/router";
import "./users/_userID/games/_game/_playtype/targets/quests/router";
import "./users/_userID/games/_game/_playtype/folders/router";
import "./users/_userID/games/_game/_playtype/folders/_folderSlug/router";
import "./users/_userID/games/_game/_playtype/router";
import "./users/_userID/games/_game/_playtype/rivals/router";

const router = API_V1_ROUTER.build();

/**
 * Return a JSON 404 response if an endpoint is hit that does not exist.
 *
 * @name ALL /api/v1/*
 */
router.all("*", (_req, res) =>
	res.status(404).json({
		success: false,
		description: "Endpoint Not Found.",
	}),
);

export default router;
