import { Router } from "express";

import uscirRouter from "./_playtype/router";

const router: Router = Router({ mergeParams: true });

router.use("/:playtype", uscirRouter);

export default router;
