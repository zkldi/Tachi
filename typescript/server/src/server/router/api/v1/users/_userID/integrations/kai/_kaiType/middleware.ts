import type { RequestHandler } from "express";

export const ValidateKaiType: RequestHandler = (req, res, next) => {
	const kaiType = req.params.kaiType;

	if (kaiType === undefined) {
		throw new Error(
			`Expected to find kaiType parameter inside ValidateKaiType on route ${req.originalUrl}.`,
		);
	}

	if (!["eag", "flo", "min"].includes(kaiType.toLowerCase())) {
		return res.status(400).json({
			success: false,
			description: `Invalid kaiType - Expected min, flo or eag.`,
		});
	}

	next();
};
