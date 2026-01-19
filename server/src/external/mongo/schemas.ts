import { TachiConfig } from "lib/setup/config";
import { p } from "prudence";
import { allImportTypes } from "tachi-common/constants/import-types";
import { SCHEMAS } from "tachi-common/lib/schemas";
import type { Databases } from "./db";
import type { PrudenceSchema } from "prudence";
import type { SchemaValidatorFunction } from "tachi-common/lib/schemas";

// The idea of this file is to export a function for every database
// that will validate that collection.

// If it returns true, that document is valid. If it throws any sort
// of error, it is invalid.

function prSchemaify(schema: PrudenceSchema) {
	return (s: unknown): true => {
		const err = p(s, schema);

		if (err) {
			throw err;
		}

		return true;
	};
}

export const DatabaseSchemas: Record<Databases, SchemaValidatorFunction> = {
	"user-name-changes": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		username: "string",
		timestamp: p.isPositiveInteger,
		previousUsername: "string",
	}),
	"import-locks": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		locked: "boolean",
	}),
	"invite-locks": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		locked: "boolean",
	}),
	"kai-auth-tokens": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		token: "string",
		refreshToken: "string",
		service: p.isIn("FLO", "EAG", "MIN"),
	}),
	"cg-card-info": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		service: p.isIn("dev", "gan", "nag"),
		cardID: "string",
		pin: "string",
	}),
	"myt-card-info": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		cardAccessCode: "string",
	}),
	"oauth2-auth-codes": prSchemaify({
		code: "string",
		userID: p.isPositiveNonZeroInteger,
		createdOn: p.isPositive,
	}),
	"password-reset-codes": prSchemaify({
		code: "string",
		userID: p.isPositiveNonZeroInteger,
		createdOn: p.isPositive,
	}),
	"verify-email-codes": prSchemaify({
		userID: p.isPositiveNonZeroInteger,
		code: "string",
		email: "string",
	}),
	migrations: prSchemaify({
		migrationID: "string",
		status: p.isIn("applied", "pending"),
		appliedOn: (self, parent) => {
			if (parent.status === "pending") {
				return (
					self === undefined ||
					`Expected appliedOn to be undefined since status was pending.`
				);
			}

			return p.isPositiveInteger(self);
		},
	}),
	"orphan-scores": prSchemaify({
		importType: p.isIn(TachiConfig.IMPORT_TYPES),
		game: p.isIn(TachiConfig.GAMES),
		userID: p.isPositiveNonZeroInteger,
		orphanID: "string",
		timeInserted: p.isPositive,
		errMsg: "?string",

		// @todo Type these properly? This will take a lot of effort, as it will require
		// formal types for all parser data:context duos.
		data: p.any,
		context: p.any,
	}),
	"import-trackers": prSchemaify({
		timeStarted: p.isPositive,
		importID: "string",
		userID: p.isPositiveInteger,
		importType: p.isIn(allImportTypes),
		userIntent: "boolean",
		type: p.isIn("ONGOING", "FAILED"),
		error: p.optional({
			message: "string",
			statusCode: "*number",
		}),
	}),
	...SCHEMAS,
};
