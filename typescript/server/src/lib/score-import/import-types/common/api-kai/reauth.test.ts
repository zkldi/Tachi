import type { KaiAuthDocument } from "tachi-common";

import { log } from "#lib/log/log";
import { ServerConfig } from "#lib/setup/config";
import DB from "#services/pg/db";
import { MockJSONFetch } from "#test-utils/mock-fetch";
import { seedUser } from "#test-utils/pg-fixtures";
import { beforeEach, describe, expect, it } from "vitest";

import { CreateKaiReauthFunction } from "./reauth";

describe("#CreateKaiReauthFunction", () => {
	let userId: number;

	beforeEach(async () => {
		({ id: userId } = await seedUser({
			username: "reauth_user",
			withCredential: true,
			withSettings: true,
		}));

		await DB.insertInto("priv_svc_kai_auth_token")
			.values({
				user_id: userId,
				service: "FLO",
				token: "foobar",
				refresh_token: "REFRESH_TOKEN",
			})
			.execute();
	});

	it("creates a working reauthentication for the service", async () => {
		if (!ServerConfig.FLO_OAUTH2_INFO) {
			throw new Error(
				`Panic in test - No dummy FLO_OAUTH2_INFO configured, and the test depends on some dummy data here.`,
			);
		}

		const authDoc: KaiAuthDocument = {
			refreshToken: "REFRESH_TOKEN",
			service: "FLO",
			token: "foobar",
			userID: userId,
		};

		const mockFetch = MockJSONFetch({
			[`${ServerConfig.FLO_API_URL}/oauth/token`]: {
				access_token: "NEW_ACCESS_TOKEN",
				refresh_token: "NEW_REFRESH_TOKEN",
			},
		});

		const reauthFn = CreateKaiReauthFunction("FLO", authDoc, log, mockFetch);

		expect(reauthFn.length).toBe(0);

		const data = await reauthFn();

		expect(data).toBe("NEW_ACCESS_TOKEN");

		const dbChange = await DB.selectFrom("priv_svc_kai_auth_token")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "FLO")
			.executeTakeFirstOrThrow();

		expect(dbChange.token).toBe("NEW_ACCESS_TOKEN");
		expect(dbChange.refresh_token).toBe("NEW_REFRESH_TOKEN");
	});

	it("throws on fetch error without changing tokens", async () => {
		if (!ServerConfig.FLO_OAUTH2_INFO) {
			throw new Error(
				`Panic in test - No dummy FLO_OAUTH2_INFO configured, and the test depends on some dummy data here.`,
			);
		}

		const authDoc: KaiAuthDocument = {
			refreshToken: "REFRESH_TOKEN",
			service: "FLO",
			token: "foobar",
			userID: userId,
		};

		const mockFetch = MockJSONFetch({});

		const reauthFn = CreateKaiReauthFunction("FLO", authDoc, log, mockFetch);

		await expect(reauthFn()).rejects.toMatchObject({
			message: "An error has occurred while attempting reauthentication.",
		});

		const dbChange = await DB.selectFrom("priv_svc_kai_auth_token")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "FLO")
			.executeTakeFirstOrThrow();

		expect(dbChange.refresh_token).toBe(authDoc.refreshToken);
		expect(dbChange.token).toBe(authDoc.token);
	});

	it("throws on invalid JSON response without changing tokens", async () => {
		if (!ServerConfig.FLO_OAUTH2_INFO) {
			throw new Error(
				`Panic in test - No dummy FLO_OAUTH2_INFO configured, and the test depends on some dummy data here.`,
			);
		}

		const authDoc: KaiAuthDocument = {
			refreshToken: "REFRESH_TOKEN",
			service: "FLO",
			token: "foobar",
			userID: userId,
		};

		const mockFetch = MockJSONFetch({
			[`${ServerConfig.FLO_API_URL}/oauth/token`]: {
				/* missing access_token */
			},
		});

		const reauthFn = CreateKaiReauthFunction("FLO", authDoc, log, mockFetch);

		await expect(reauthFn()).rejects.toMatchObject({
			message: "An error has occurred while attempting reauthentication.",
		});

		const dbChange = await DB.selectFrom("priv_svc_kai_auth_token")
			.selectAll()
			.where("user_id", "=", userId)
			.where("service", "=", "FLO")
			.executeTakeFirstOrThrow();

		expect(dbChange.refresh_token).toBe(authDoc.refreshToken);
		expect(dbChange.token).toBe(authDoc.token);
	});
});
