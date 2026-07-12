import { ONE_MONTH } from "#lib/constants/time";
import { ServerConfig } from "#lib/setup/config";
import { mkFakeUser } from "#test-utils/misc";
import { describe, expect, it } from "vitest";

import { GetTotalAllowedInvites } from "./invites";

describe("GetTotalAllowedInvites", () => {
	it("scales invite allowance by account age and badges", () => {
		expect(GetTotalAllowedInvites(mkFakeUser(1, { joinDate: Date.now() }))).toBe(0);

		expect(
			GetTotalAllowedInvites(mkFakeUser(1, { joinDate: Date.now(), badges: ["beta"] })),
		).toBe(ServerConfig.INVITE_CODE_CONFIG?.BETA_USER_BONUS);

		expect(
			GetTotalAllowedInvites(mkFakeUser(1, { joinDate: Date.now(), badges: ["alpha"] })),
		).toBe(ServerConfig.INVITE_CODE_CONFIG?.BETA_USER_BONUS);

		expect(GetTotalAllowedInvites(mkFakeUser(1, { joinDate: Date.now() - ONE_MONTH }))).toBe(
			ServerConfig.INVITE_CODE_CONFIG?.BATCH_SIZE,
		);

		expect(
			GetTotalAllowedInvites(mkFakeUser(1, { joinDate: Date.now() - ONE_MONTH * 2 })),
		).toBe((ServerConfig.INVITE_CODE_CONFIG?.BATCH_SIZE ?? 0) * 2);
	});
});
