import type { RequestHandler } from "express";

export const ValidateIRClientVersion: RequestHandler = (req, res, next) => {
	const header = req.header("X-TachiIR-Version");

	if (!header?.startsWith("v2") && !header?.startsWith("v3") && !header?.startsWith("v4")) {
		return res.status(400).json({
			success: false,
			description: `Invalid X-TachiIR-Version.`,
		});
	}

	next();
};
