/**
 * Integration tests for the CDN layer (MinIO/S3). Requires the same setup as the rest of the
 * server suite: `.env.test` CDN settings, and MinIO reachable at that endpoint (see
 * `vitest.globalSetup.ts` + `ensure-test-cdn-bucket`). Object keys use random UUIDs so workers can
 * run in parallel without sharing keys.
 */

import { ServerConfig } from "#lib/setup/config";
import { HashSHA256 } from "#utils/crypto";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { CDNDelete, CDNRedirect, CDNRetrieve, CDNStoreOrOverwrite } from "./cdn";
import { cdnObjectKey } from "./s3";

/** Unique object path per test so parallel vitest workers do not clobber the same MinIO keys. */
function testKey(suffix: string) {
	return `/vitest/${randomUUID()}/${suffix}`;
}

describe("cdn (S3 integration)", () => {
	it("stores and retrieves string content", async () => {
		const loc = testKey("hello.txt");
		await CDNStoreOrOverwrite(loc, "hello world");
		const buf = await CDNRetrieve(loc);
		expect(buf.toString("utf8")).toBe("hello world");
		await CDNDelete(loc);
	});

	it("stores and retrieves binary buffers", async () => {
		const loc = testKey("bin.dat");
		const original = Buffer.from([0, 255, 128, 1]);
		await CDNStoreOrOverwrite(loc, original);
		const got = await CDNRetrieve(loc);
		expect(HashSHA256(got)).toBe(HashSHA256(original));
		await CDNDelete(loc);
	});

	it("overwrites an existing object", async () => {
		const loc = testKey("overwrite.txt");
		await CDNStoreOrOverwrite(loc, "first");
		await CDNStoreOrOverwrite(loc, "second");
		expect((await CDNRetrieve(loc)).toString("utf8")).toBe("second");
		await CDNDelete(loc);
	});

	it("handles concurrent writes to different keys", async () => {
		const a = testKey("concurrent-a.txt");
		const b = testKey("concurrent-b.txt");
		await Promise.all([CDNStoreOrOverwrite(a, "alpha"), CDNStoreOrOverwrite(b, "beta")]);
		expect((await CDNRetrieve(a)).toString("utf8")).toBe("alpha");
		expect((await CDNRetrieve(b)).toString("utf8")).toBe("beta");
		await CDNDelete(a);
		await CDNDelete(b);
	});

	it("supports nested paths without leading slash segments in the middle", async () => {
		const loc = testKey("a/b/c/d.txt");
		await CDNStoreOrOverwrite(loc, "nested");
		expect((await CDNRetrieve(loc)).toString("utf8")).toBe("nested");
		await CDNDelete(loc);
	});

	it("supports API-style paths with a leading slash (profile URLs)", async () => {
		const loc = `/users/${randomUUID()}/pfp-test`;
		await CDNStoreOrOverwrite(loc, "pfp-bytes");
		expect((await CDNRetrieve(loc)).toString("utf8")).toBe("pfp-bytes");
		await CDNDelete(loc);
	});

	it("rejects GetObject when the key does not exist", async () => {
		const loc = testKey("nope.bin");
		await expect(CDNRetrieve(loc)).rejects.toThrow();
	});

	it("CDNDelete on a missing key does not throw (S3 idempotent delete)", async () => {
		const loc = testKey("never-written.txt");
		await CDNDelete(loc);
	});
});

describe("CDNRedirect", () => {
	it("redirects to WEB_LOCATION + fileLoc", () => {
		const res = { redirect: vi.fn() };
		CDNRedirect(res as never, "/users/1/pfp-hash");

		expect(res.redirect).toHaveBeenCalledOnce();
		expect(res.redirect).toHaveBeenCalledWith(
			`${ServerConfig.CDN_CONFIG.WEB_LOCATION}/users/1/pfp-hash`,
		);
	});

	it("throws when fileLoc does not start with /", () => {
		const res = { redirect: vi.fn() };
		expect(() => CDNRedirect(res as never, "bad")).toThrow(/did not start with \//u);
		expect(res.redirect).not.toHaveBeenCalled();
	});
});

describe("cdnObjectKey", () => {
	it("matches KEY_PREFIX + fileLoc from the loaded test config", () => {
		const prefix = ServerConfig.CDN_CONFIG.SAVE_LOCATION.KEY_PREFIX ?? "";
		expect(cdnObjectKey("/x")).toBe(`${prefix}/x`);
	});
});
