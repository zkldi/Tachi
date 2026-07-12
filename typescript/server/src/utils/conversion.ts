import { UserAuthLevels } from "tachi-common";
import { type AuthLevel } from "tachi-db";

import { staticAssertUnreachable } from "./misc";

export function AuthLevelToInt(authLevel: AuthLevel): UserAuthLevels {
	switch (authLevel) {
		case "banned":
			return UserAuthLevels.BANNED;
		case "admin":
			return UserAuthLevels.ADMIN;
		case "user":
			return UserAuthLevels.USER;
		default:
			staticAssertUnreachable(authLevel);
	}
}
