import type { NextFunction, Request, Response } from "express";

/**
 * Disallow complex query strings by enforcing single key:value pairs.
 */
function SanitiseQString(req: Request, res: Response, next: NextFunction) {
	if (req.method === "GET") {
		for (const [key, value] of Object.entries(req.query)) {
			if (typeof value !== "string") {
				return res.status(400).json({
					success: false,
					description: `Invalid request with key ${key}`,
				});
			}
		}
	}

	next();
}

export default SanitiseQString;
