import { seedApiClient } from "#actions/test-utils/api-tokens";
import { SYMBOL_TACHI_DATA } from "#lib/constants/tachi";
import { expressRequestMock } from "#test-utils/mock-request";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { GetClientFromID } from "./middleware";

describe("GetClientFromID", () => {
	beforeEach(async () => {
		const { id: userId } = await seedUser({
			username: "api_client_owner",
			withCredential: true,
			withSettings: true,
		});

		await seedApiClient({
			clientId: "OAUTH2_CLIENT_ID",
			authorId: userId,
			name: "Test_Service",
			clientSecret: "OAUTH2_CLIENT_SECRET",
			customiseProfile: true,
			redirectUri: "https://example.com/callback",
		});
	});

	it("assigns the client to req tachi data when it exists", async () => {
		const { req } = await expressRequestMock(GetClientFromID, {
			params: {
				clientID: "OAUTH2_CLIENT_ID",
			},
			[SYMBOL_TACHI_DATA]: {},
		});

		expect(req[SYMBOL_TACHI_DATA]?.apiClientDoc).toEqual({
			clientID: "OAUTH2_CLIENT_ID",
			name: "Test_Service",
			author: 1,
			requestedPermissions: ["customise_profile"],
			redirectUri: "https://example.com/callback",
			webhookUri: null,
			apiKeyTemplate: null,
			apiKeyFilename: null,
		});
	});

	it("returns 404 if the client does not exist", async () => {
		const { res } = await expressRequestMock(GetClientFromID, {
			params: {
				clientID: "NONSENSE",
			},
			[SYMBOL_TACHI_DATA]: {},
		});

		expect(res.statusCode).toBe(404);

		expect(res._getJSONData()).toEqual({
			success: false,
			description: "This client does not exist.",
		});
	});
});
