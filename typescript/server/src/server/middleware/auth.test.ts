import { SYMBOL_TACHI_API_AUTH } from "#lib/constants/tachi";
import DB from "#services/pg/db";
import mockApi from "#test-utils/mock-api";
import { expressRequestMock } from "#test-utils/mock-request";
import { seedUser } from "#test-utils/pg-fixtures";
import { ALL_PERMISSIONS } from "tachi-common";
import { describe, expect, it } from "vitest";

import { SetRequestPermissions } from "./auth";

describe("SetRequestPermissions", () => {
	it("assigns API token data to req when Authorization Bearer matches priv_api_token", async () => {
		const { id: userId } = await seedUser({ username: "api_token_user" });

		await DB.insertInto("priv_api_token")
			.values({
				token: "mock_token",
				user_id: userId,
				identifier: "Mock API Token",
				from_oauth2_client: null,
				pm_customise_profile: true,
				pm_customise_score: null,
				pm_customise_session: null,
				pm_delete_score: null,
				pm_manage_rivals: null,
				pm_manage_targets: null,
				pm_submit_score: null,
				pm_manage_challenges: null,
			})
			.execute();

		const { req } = await expressRequestMock(SetRequestPermissions, {
			headers: {
				authorization: "Bearer mock_token",
			},
		});

		expect(req[SYMBOL_TACHI_API_AUTH]).toEqual({
			userID: userId,
			identifier: "Mock API Token",
			permissions: {
				customise_profile: true,
			},
			token: "mock_token",
			fromAPIClient: null,
		});
	});

	it("assigns guest token when no Authorization header is sent", async () => {
		const { req } = await expressRequestMock(SetRequestPermissions);

		expect(req[SYMBOL_TACHI_API_AUTH]).toEqual({
			userID: null,
			identifier: "Guest Token",
			permissions: {},
			token: null,
			fromAPIClient: null,
		});
	});

	it("returns 400 when Authorization is not Bearer", async () => {
		const { res } = await expressRequestMock(SetRequestPermissions, {
			headers: {
				authorization: "Basic Foo",
			},
		});

		expect(res.statusCode).toBe(400);

		const json = res._getJSONData() as { description?: string };

		expect(json.description).toMatch(/Invalid Authorization Type - Expected Bearer/u);
	});

	it("returns 401 when Bearer token is empty", async () => {
		const { res } = await expressRequestMock(SetRequestPermissions, {
			headers: {
				authorization: "Bearer ",
			},
		});

		expect(res.statusCode).toBe(401);

		const json = res._getJSONData() as { description?: string };

		expect(json.description).toMatch(/Invalid token/u);
	});

	it("returns 401 when Bearer token is unknown", async () => {
		const { res } = await expressRequestMock(SetRequestPermissions, {
			headers: {
				authorization: "Bearer unknown_token",
			},
		});

		expect(res.statusCode).toBe(401);

		const json = res._getJSONData() as { description?: string };

		expect(json.description).toMatch(
			/The provided API token does not correspond with any key in the database/u,
		);
	});

	it("assigns session-based auth when req.session.tachi.user.id is set", async () => {
		const { id: userId } = await seedUser({ username: "session_auth_user" });

		const { req } = await expressRequestMock(SetRequestPermissions, {
			session: {
				tachi: {
					user: { id: userId },
					settings: {},
				},
			},
		} as never);

		expect(req[SYMBOL_TACHI_API_AUTH]).toEqual({
			userID: userId,
			identifier: `Session-Key ${userId}`,
			token: null,
			permissions: ALL_PERMISSIONS,
			fromAPIClient: null,
		});
	});
});

describe("RejectIfBanned (integration)", () => {
	it("returns 403 on /api/v1/status when the API user is banned", async () => {
		const { id: userId } = await seedUser({ username: "banned_api_user" });

		await DB.insertInto("priv_api_token")
			.values({
				token: "mock_token",
				user_id: userId,
				identifier: "Mock API Token",
				from_oauth2_client: null,
				pm_customise_profile: true,
				pm_customise_score: null,
				pm_customise_session: null,
				pm_delete_score: null,
				pm_manage_rivals: null,
				pm_manage_targets: null,
				pm_submit_score: null,
				pm_manage_challenges: null,
			})
			.execute();

		await DB.updateTable("account")
			.set({ auth_level: "banned" })
			.where("id", "=", userId)
			.execute();

		const res = await mockApi.get("/api/v1/status").set("Authorization", "Bearer mock_token");

		expect(res.statusCode).toBe(403);
	});
});
