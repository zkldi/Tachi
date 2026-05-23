import { MakeAction } from "#lib/actions/actions";
import { CDNStoreWithMeta } from "#lib/cdn/cdn";
import { GetProfileBannerURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import { HashSHA256 } from "#utils/crypto";
import { ExpectedErr } from "bliss";
import sharp from "sharp";

/** Max dimensions for stored profile banners (used as a full-page background). */
const BANNER_MAX_WIDTH = 1920;
const BANNER_MAX_HEIGHT = 1080;

/**
 * Resizes any image (including animated GIFs) to at most BANNER_MAX_WIDTH × BANNER_MAX_HEIGHT
 * and re-encodes as WebP, preserving all animation frames.
 */
async function resizeBanner(buf: Buffer): Promise<Buffer> {
	return sharp(buf, { animated: true })
		.resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
}

export const ACTION_ChangeBanner = MakeAction(
	"CHANGE_BANNER",
	async (taker, { "!fileBuffer": fileBuffer, fileMimetype }) => {
		if (
			fileMimetype !== "image/jpeg" &&
			fileMimetype !== "image/png" &&
			fileMimetype !== "image/gif"
		) {
			// GIF is deliberately not mentioned in the error message as it's an easter egg
			throw new ExpectedErr(400, "Invalid file - only JPG and PNG files are supported.");
		}

		const storedBuffer = await resizeBanner(fileBuffer);
		const contentHash = HashSHA256(storedBuffer);

		await CDNStoreWithMeta(GetProfileBannerURL(taker.acct.id, contentHash), storedBuffer, {
			contentType: "image/webp",
			cacheControl: "public, max-age=31536000, immutable",
		});

		await DB.updateTable("account")
			.set({ custom_banner_location: contentHash })
			.where("id", "=", taker.acct.id)
			.execute();

		return { contentHash };
	},
);
