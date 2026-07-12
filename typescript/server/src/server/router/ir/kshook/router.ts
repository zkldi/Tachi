import { Router } from "express";

import SV6CRouter from "./sv6c/router";

const router: Router = Router({ mergeParams: true });

router.use("/sv6c", SV6CRouter);

export default router;
