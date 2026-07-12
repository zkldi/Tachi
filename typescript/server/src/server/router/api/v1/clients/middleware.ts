import type { RequestHandler } from "express";

import { GetClientByID } from "#utils/queries/api-clients";
import { REQ_AssignToReqTachiData } from "#utils/req-tachi-data";

export const GetClientFromID: RequestHandler = async (req, res, next) => {
	const client = await GetClientByID(req.params.clientID);

	if (!client) {
		return res.status(404).json({
			success: false,
			description: `This client does not exist.`,
		});
	}

	// Strip the client secret - this middleware is used for public lookups.
	const { clientSecret: _secret, ...publicClient } = client;

	REQ_AssignToReqTachiData(req, { apiClientDoc: publicClient });

	next();
};
