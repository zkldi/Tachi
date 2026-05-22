import type { RequestHandler } from "express";
import type { integer } from "tachi-common";

import { SIXTEEN_MEGABTYES } from "#lib/constants/filesize";
import { log } from "#lib/log/log";
import multer, { MulterError } from "multer";

// 16MB
export const DefaultMulterUpload = multer({ limits: { fileSize: 1024 * 1024 * 16 } });

export const CreateMulterSingleUploadMiddleware = (
	fieldName: string,
	fileSize: integer = SIXTEEN_MEGABTYES,
	throwOnNoFile = true,
): RequestHandler => {
	const UploadMW = multer({ limits: { fileSize } }).single(fieldName);

	return (req, res, next) => {
		UploadMW(req, res, (err: unknown) => {
			if (err instanceof MulterError) {
				log.info({ err }, `Multer Error.`);

				return res.status(400).json({
					success: false,
					description:
						"File provided was too large, corrupt, or provided in the wrong field.",
				});
			} else if (err !== undefined && err !== null) {
				log.error({ err }, `Unknown file import error.`);

				return res.status(500).json({
					success: false,
					description: `An internal server error has occurred.`,
				});
			}

			if (!req.file && throwOnNoFile) {
				return res.status(400).json({
					success: false,
					description: `Expected a file for field ${fieldName}.`,
				});
			}

			// CRITICALLY IMPORTANT LINE OF CODE
			// THINGS DEALING WITH FILE UPLOADS **DO NOT** MOUNT SAFE-BODY OTHERWISE.
			req.safeBody = req.body as Record<string, unknown>;

			next();
		});
	};
};
