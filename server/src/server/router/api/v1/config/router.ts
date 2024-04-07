import { Router } from "express";
import { ServerConfig, TachiConfig } from "lib/setup/config";
import { RequireBokutachi } from "server/middleware/type-require";

const router: Router = Router({ mergeParams: true });

/**
 * Returns Tachi Configuration info, such as server name, type, supported games
 * and more.
 *
 * @name GET /api/v1/config
 */
router.get("/", (req, res) =>
	res.status(200).json({
		success: true,
		description: `Returned configuration info.`,
		body: TachiConfig,
	})
);

/**
 * Returns the value of the BEATORAJA_QUEUE_SIZE.
 *
 * @name GET /api/v1/config/beatoraja-queue-size
 */
router.get("/beatoraja-queue-size", RequireBokutachi, (req, res) =>
	res.status(200).json({
		success: true,
		description: `Returned BEATORAJA_QUEUE_SIZE.`,
		body: ServerConfig.BEATORAJA_QUEUE_SIZE,
	})
);

/**
 * Returns the maximum amount of rivals a user can have on this instance.
 *
 * @name GET /api/v1/config/max-rivals
 */
router.get("/max-rivals", (req, res) =>
	res.status(200).json({
		success: true,
		description: `Returned MAX_RIVALS.`,
		body: ServerConfig.MAX_RIVALS,
	})
);

export default router;
