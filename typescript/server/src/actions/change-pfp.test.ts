/**
 * Integration tests for ACTION_ChangePfp, ACTION_DeletePfp, ACTION_ChangeBanner, and
 * ACTION_DeleteBanner.
 *
 * These tests hit real MinIO (via the test CDN config) and pass real image buffers through
 * sharp, so they verify the full upload pipeline: resize → WebP encode → S3 store → DB update.
 */

import { CDNDelete, CDNRetrieve } from "#lib/cdn/cdn";
import { GetProfileBannerURL, GetProfilePictureURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import { seedUser } from "#test-utils/pg-fixtures";
import { GetKTDataBuffer } from "#test-utils/test-data";
import { HashSHA256 } from "#utils/crypto";
import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ACTION_ChangeBanner } from "./change-banner";
import { ACTION_ChangePfp } from "./change-pfp";
import { ACTION_DeleteBanner } from "./delete-banner";
import { ACTION_DeletePfp } from "./delete-pfp";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Real 600×500 PNG (64 KB). Sharp will resize it to fit within 256×256. */
const ACORN_PNG = GetKTDataBuffer("/images/acorn.png");

/** Minimal 4×4 single-frame GIF, generated once before all tests. */
let MINIMAL_GIF: Buffer;

beforeAll(async () => {
	MINIMAL_GIF = await sharp({
		create: { background: { b: 0, g: 0, r: 255 }, channels: 3, height: 4, width: 4 },
	})
		.gif()
		.toBuffer();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPfpLocation(userId: number) {
	const row = await DB.selectFrom("account")
		.select("custom_pfp_location")
		.where("id", "=", userId)
		.executeTakeFirstOrThrow();

	return row.custom_pfp_location;
}

async function getBannerLocation(userId: number) {
	const row = await DB.selectFrom("account")
		.select("custom_banner_location")
		.where("id", "=", userId)
		.executeTakeFirstOrThrow();

	return row.custom_banner_location;
}

async function seedUserWithPfp(userId: number, hash: string) {
	await DB.updateTable("account")
		.set({ custom_pfp_location: hash })
		.where("id", "=", userId)
		.execute();
}

async function seedUserWithBanner(userId: number, hash: string) {
	await DB.updateTable("account")
		.set({ custom_banner_location: hash })
		.where("id", "=", userId)
		.execute();
}

// ─── ACTION_ChangePfp ─────────────────────────────────────────────────────────

describe("ACTION_ChangePfp", () => {
	let userId: number;
	let username: string;
	const cdnCleanup: string[] = [];

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
		cdnCleanup.length = 0;
	});

	afterEach(async () => {
		await Promise.all(cdnCleanup.map((p) => CDNDelete(p)));
	});

	// ── Resize + S3 integration ───────────────────────────────────────────────

	it("resizes a PNG to fit within 256×256 and stores it as WebP in S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfilePictureURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);
		const meta = await sharp(stored, { animated: true }).metadata();

		expect(meta.format).toBe("webp");
		expect(meta.width).toBeLessThanOrEqual(256);
		expect(meta.height).toBeLessThanOrEqual(256);
		expect(stored.length).toBeLessThan(ACORN_PNG.length);
	});

	it("resizes a JPEG to fit within 256×256 and stores it as WebP in S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/jpeg",
		});

		const cdnPath = GetProfilePictureURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);
		const meta = await sharp(stored, { animated: true }).metadata();

		expect(meta.format).toBe("webp");
		expect(meta.width).toBeLessThanOrEqual(256);
		expect(meta.height).toBeLessThanOrEqual(256);
	});

	it("converts a GIF to WebP and stores it in S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": MINIMAL_GIF,
			fileMimetype: "image/gif",
		});

		const cdnPath = GetProfilePictureURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);
		const meta = await sharp(stored, { animated: true }).metadata();

		expect(meta.format).toBe("webp");
	});

	it("hashes the resized WebP output, not the original upload", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfilePictureURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);

		expect(contentHash).toBe(HashSHA256(stored));
		expect(contentHash).not.toBe(HashSHA256(ACORN_PNG));
	});

	// ── Database updates ──────────────────────────────────────────────────────

	it("persists the content hash of the stored WebP to custom_pfp_location", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfilePictureURL(userId, contentHash));

		expect(await getPfpLocation(userId)).toBe(contentHash);
	});

	it("does not update other users' custom_pfp_location", async () => {
		const other = await seedUser({ username: "other_user" });
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfilePictureURL(userId, contentHash));

		expect(await getPfpLocation(other.id)).toBeNull();
	});

	// ── Mimetype validation ───────────────────────────────────────────────────

	it("throws 400 for an unsupported mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangePfp(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("does not update custom_pfp_location on a bad mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangePfp(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toThrow();

		expect(await getPfpLocation(userId)).toBeNull();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { acct: { id: userId, username }, ip: "10.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfilePictureURL(userId, contentHash));

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CHANGE_PFP")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			ip: "10.0.0.1",
			kind: "CHANGE_PFP",
			result: "GOOD",
			user_id: userId,
		});
	});

	it("writes a BAD action row on invalid mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangePfp(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_PFP")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not store the file buffer content in the audit log input", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfilePictureURL(userId, contentHash));

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_PFP")
			.executeTakeFirstOrThrow();

		expect(JSON.stringify(action.input)).not.toContain(ACORN_PNG.toString("base64"));
	});
});

// ─── ACTION_DeletePfp ─────────────────────────────────────────────────────────

describe("ACTION_DeletePfp", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── 404 guard ─────────────────────────────────────────────────────────────

	it("throws 404 when the user has no custom pfp", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(ACTION_DeletePfp(taker, {})).rejects.toMatchObject({ code: 404 });
	});

	it("writes a BAD action row when the user has no custom pfp", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(ACTION_DeletePfp(taker, {})).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "DELETE_PFP")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("uploads a pfp then deletes it, removing it from S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangePfp(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfilePictureURL(userId, contentHash);

		await ACTION_DeletePfp(taker, {});

		expect(await getPfpLocation(userId)).toBeNull();
		await expect(CDNRetrieve(cdnPath)).rejects.toThrow();
	});

	it("does not touch other users' custom_pfp_location", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedUserWithPfp(other.id, "otherhash");
		await seedUserWithPfp(userId, "myhash");

		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await ACTION_DeletePfp(taker, {});

		expect(await getPfpLocation(other.id)).toBe("otherhash");
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		await seedUserWithPfp(userId, "existinghash");
		const taker = { acct: { id: userId, username }, ip: "10.0.0.1" };

		await ACTION_DeletePfp(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_PFP")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			ip: "10.0.0.1",
			kind: "DELETE_PFP",
			result: "GOOD",
			user_id: userId,
		});
	});
});

// ─── ACTION_ChangeBanner ──────────────────────────────────────────────────────

describe("ACTION_ChangeBanner", () => {
	let userId: number;
	let username: string;
	const cdnCleanup: string[] = [];

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
		cdnCleanup.length = 0;
	});

	afterEach(async () => {
		await Promise.all(cdnCleanup.map((p) => CDNDelete(p)));
	});

	// ── Resize + S3 integration ───────────────────────────────────────────────

	it("converts a PNG to WebP and stores it in S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfileBannerURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);
		const meta = await sharp(stored, { animated: true }).metadata();

		expect(meta.format).toBe("webp");
	});

	it("converts a GIF to WebP and stores it in S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": MINIMAL_GIF,
			fileMimetype: "image/gif",
		});

		const cdnPath = GetProfileBannerURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);
		const meta = await sharp(stored, { animated: true }).metadata();

		expect(meta.format).toBe("webp");
	});

	it("hashes the resized WebP output, not the original upload", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfileBannerURL(userId, contentHash);
		cdnCleanup.push(cdnPath);
		const stored = await CDNRetrieve(cdnPath);

		expect(contentHash).toBe(HashSHA256(stored));
		expect(contentHash).not.toBe(HashSHA256(ACORN_PNG));
	});

	// ── Database updates ──────────────────────────────────────────────────────

	it("persists the content hash to custom_banner_location", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfileBannerURL(userId, contentHash));

		expect(await getBannerLocation(userId)).toBe(contentHash);
	});

	it("does not update other users' custom_banner_location", async () => {
		const other = await seedUser({ username: "other_user" });
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfileBannerURL(userId, contentHash));

		expect(await getBannerLocation(other.id)).toBeNull();
	});

	// ── Mimetype validation ───────────────────────────────────────────────────

	it("throws 400 for an unsupported mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangeBanner(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toMatchObject({ code: 400 });
	});

	it("does not update custom_banner_location on a bad mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangeBanner(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toThrow();

		expect(await getBannerLocation(userId)).toBeNull();
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		const taker = { acct: { id: userId, username }, ip: "10.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfileBannerURL(userId, contentHash));

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "CHANGE_BANNER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			ip: "10.0.0.1",
			kind: "CHANGE_BANNER",
			result: "GOOD",
			user_id: userId,
		});
	});

	it("writes a BAD action row on invalid mimetype", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(
			ACTION_ChangeBanner(taker, { "!fileBuffer": ACORN_PNG, fileMimetype: "image/webp" }),
		).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "CHANGE_BANNER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	it("does not store the file buffer content in the audit log input", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		cdnCleanup.push(GetProfileBannerURL(userId, contentHash));

		const action = await DB.selectFrom("action")
			.select("input")
			.where("kind", "=", "CHANGE_BANNER")
			.executeTakeFirstOrThrow();

		expect(JSON.stringify(action.input)).not.toContain(ACORN_PNG.toString("base64"));
	});
});

// ─── ACTION_DeleteBanner ──────────────────────────────────────────────────────

describe("ACTION_DeleteBanner", () => {
	let userId: number;
	let username: string;

	beforeEach(async () => {
		({ id: userId, username } = await seedUser({ username: "test_user" }));
	});

	// ── 404 guard ─────────────────────────────────────────────────────────────

	it("throws 404 when the user has no custom banner", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(ACTION_DeleteBanner(taker, {})).rejects.toMatchObject({ code: 404 });
	});

	it("writes a BAD action row when the user has no custom banner", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await expect(ACTION_DeleteBanner(taker, {})).rejects.toThrow();

		const action = await DB.selectFrom("action")
			.select("result")
			.where("kind", "=", "DELETE_BANNER")
			.executeTakeFirstOrThrow();

		expect(action.result).toBe("BAD");
	});

	// ── Success path ──────────────────────────────────────────────────────────

	it("uploads a banner then deletes it, removing it from S3", async () => {
		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		const { contentHash } = await ACTION_ChangeBanner(taker, {
			"!fileBuffer": ACORN_PNG,
			fileMimetype: "image/png",
		});

		const cdnPath = GetProfileBannerURL(userId, contentHash);

		await ACTION_DeleteBanner(taker, {});

		expect(await getBannerLocation(userId)).toBeNull();
		await expect(CDNRetrieve(cdnPath)).rejects.toThrow();
	});

	it("does not touch other users' custom_banner_location", async () => {
		const other = await seedUser({ username: "other_user" });
		await seedUserWithBanner(other.id, "otherhash");
		await seedUserWithBanner(userId, "myhash");

		const taker = { acct: { id: userId, username }, ip: "127.0.0.1" };

		await ACTION_DeleteBanner(taker, {});

		expect(await getBannerLocation(other.id)).toBe("otherhash");
	});

	// ── Audit log ─────────────────────────────────────────────────────────────

	it("writes a GOOD action row on success", async () => {
		await seedUserWithBanner(userId, "existinghash");
		const taker = { acct: { id: userId, username }, ip: "10.0.0.1" };

		await ACTION_DeleteBanner(taker, {});

		const action = await DB.selectFrom("action")
			.selectAll()
			.where("kind", "=", "DELETE_BANNER")
			.executeTakeFirstOrThrow();

		expect(action).toMatchObject({
			ip: "10.0.0.1",
			kind: "DELETE_BANNER",
			result: "GOOD",
			user_id: userId,
		});
	});
});
