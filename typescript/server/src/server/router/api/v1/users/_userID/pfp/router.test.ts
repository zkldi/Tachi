import { seedApiToken } from "#actions/test-utils/api-tokens";
import { CDNRetrieve, CDNStoreOrOverwrite } from "#lib/cdn/cdn";
import { GetProfilePictureURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { GetKTDataBuffer } from "#test-utils/test-data";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

describe("GET /api/v1/users/:userID/pfp", () => {
	beforeEach(async () => {
		await seedUser({ username: "pfp_get_user" });
	});

	it("returns the default profile picture if user has no custom pfp", async () => {
		await CDNStoreOrOverwrite("/users/default/pfp", "test");

		const res = await mockApi.get("/api/v1/users/1/pfp").redirects(1);

		expect(res.body.toString()).toBe("test");
	});

	it("returns a custom profile picture when one is set", async () => {
		await CDNStoreOrOverwrite(GetProfilePictureURL(1, "checksum"), "foo");
		await DB.updateTable("account")
			.set({ custom_pfp_location: "checksum" })
			.where("account.id", "=", 1)
			.execute();

		const res = await mockApi.get("/api/v1/users/1/pfp").redirects(1);

		expect(res.body.toString()).toBe("foo");
	});
});

describe("PUT /api/v1/users/:userID/pfp", () => {
	beforeEach(async () => {
		await seedUser({ username: "pfp_put_user" });
		await seedApiToken({ token: "fake_api_token", userId: 1, identifier: "pfp_tok" });
		await DB.updateTable("priv_api_token")
			.set({ pm_customise_profile: true })
			.where("priv_api_token.token", "=", "fake_api_token")
			.execute();
	});

	it("stores a profile picture when the user had no custom pfp", async () => {
		const img = GetKTDataBuffer("/images/acorn.png");

		const res = await mockApi
			.put("/api/v1/users/1/pfp")
			.set("Authorization", "Bearer fake_api_token")
			.attach("pfp", img, "file.jpg");

		expect(res.status).toBe(200);

		const { custom_pfp_location } = await DB.selectFrom("account")
			.select("custom_pfp_location")
			.where("id", "=", 1)
			.executeTakeFirstOrThrow();

		const stored = await CDNRetrieve(GetProfilePictureURL(1, custom_pfp_location!));

		expect(stored.length).toBeLessThan(img.length);
	});

	it("stores a profile picture when the user already had a custom pfp", async () => {
		await DB.updateTable("account")
			.set({ custom_pfp_location: "checksum" })
			.where("account.id", "=", 1)
			.execute();

		const img = GetKTDataBuffer("/images/acorn.png");

		const res = await mockApi
			.put("/api/v1/users/1/pfp")
			.set("Authorization", "Bearer fake_api_token")
			.attach("pfp", img, "file.png");

		expect(res.status).toBe(200);

		const { custom_pfp_location } = await DB.selectFrom("account")
			.select("custom_pfp_location")
			.where("id", "=", 1)
			.executeTakeFirstOrThrow();

		const stored = await CDNRetrieve(GetProfilePictureURL(1, custom_pfp_location!));

		expect(stored.length).toBeLessThan(img.length);
	});
});
