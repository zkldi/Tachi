import { seedApiToken } from "#actions/test-utils/api-tokens";
import { CDNRetrieve, CDNStoreOrOverwrite } from "#lib/cdn/cdn";
import { GetProfileBannerURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import mockApi, { CloseServerConnection } from "#test-utils/mock-api";
import { seedUser } from "#test-utils/pg-fixtures";
import { GetKTDataBuffer } from "#test-utils/test-data";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

afterAll(() => CloseServerConnection());

describe("GET /api/v1/users/:userID/banner", () => {
	beforeEach(async () => {
		await seedUser({ username: "banner_get_user" });
	});

	it("returns the default banner when the user has no custom banner", async () => {
		await CDNStoreOrOverwrite("/users/default/banner", "test");
		const res = await mockApi.get("/api/v1/users/1/banner").redirects(1);

		expect(res.status).toBe(200);
		expect(res.body.toString()).toBe("test");
	});

	it("returns a custom banner when one is set", async () => {
		await CDNStoreOrOverwrite(GetProfileBannerURL(1, "checksum"), "foo");
		await DB.updateTable("account")
			.set({ custom_banner_location: "checksum" })
			.where("account.id", "=", 1)
			.execute();

		const res = await mockApi.get("/api/v1/users/1/banner").redirects(1);

		expect(res.status).toBe(200);
		expect(res.body.toString()).toBe("foo");
	});
});

describe("PUT /api/v1/users/:userID/banner", () => {
	beforeEach(async () => {
		await seedUser({ username: "banner_put_user" });
		await seedApiToken({ token: "fake_api_token", userId: 1, identifier: "bnr_tok" });
		await DB.updateTable("priv_api_token")
			.set({ pm_customise_profile: true })
			.where("priv_api_token.token", "=", "fake_api_token")
			.execute();
	});

	it("stores a banner when the user had no custom banner", async () => {
		const img = GetKTDataBuffer("/images/acorn.png");

		const res = await mockApi
			.put("/api/v1/users/1/banner")
			.set("Authorization", "Bearer fake_api_token")
			.attach("banner", img, "file.jpg");

		expect(res.status).toBe(200);

		const { custom_banner_location } = await DB.selectFrom("account")
			.select("custom_banner_location")
			.where("id", "=", 1)
			.executeTakeFirstOrThrow();

		const stored = await CDNRetrieve(GetProfileBannerURL(1, custom_banner_location!));

		expect(stored.length).toBeLessThan(img.length);
	});

	it("stores a banner when the user already had a custom banner", async () => {
		await DB.updateTable("account")
			.set({ custom_banner_location: "checksum" })
			.where("account.id", "=", 1)
			.execute();

		const img = GetKTDataBuffer("/images/acorn.png");

		const res = await mockApi
			.put("/api/v1/users/1/banner")
			.set("Authorization", "Bearer fake_api_token")
			.attach("banner", img, "file.jpg");

		expect(res.status).toBe(200);

		const { custom_banner_location } = await DB.selectFrom("account")
			.select("custom_banner_location")
			.where("id", "=", 1)
			.executeTakeFirstOrThrow();

		const stored = await CDNRetrieve(GetProfileBannerURL(1, custom_banner_location!));

		expect(stored.length).toBeLessThan(img.length);
	});
});
