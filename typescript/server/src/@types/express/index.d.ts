import type { SYMBOL_TACHI_API_AUTH, SYMBOL_TACHI_DATA } from "#lib/constants/tachi";
import type { TachiRequestData, TachiSessionData } from "#utils/types";
import type { Session, SessionData } from "express-session";
import type { APITokenDocument } from "tachi-common";

// this only exists for testing context - it doesn't seem to work properly otherwise.
declare module "express-session" {
	// Inject additional properties on express-session
	interface SessionData {
		tachi: TachiSessionData;
	}
}

declare global {
	namespace Express {
		interface Request {
			session: Partial<SessionData> & Session;

			[SYMBOL_TACHI_DATA]?: Partial<TachiRequestData>;

			// even though this is technically *not* present on every request
			// it's always assigned in the main router, so its functionally equivalent.
			[SYMBOL_TACHI_API_AUTH]: APITokenDocument;
		}
	}
}
