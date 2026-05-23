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
 * Resizes a JPEG or PNG banner to at most BANNER_MAX_WIDTH × BANNER_MAX_HEIGHT and
 * re-encodes as WebP. GIFs are returned unchanged to preserve animations.
 */
async function resizeBanner(
	buf: Buffer,
	mimetype: string,
): Promise<{ contentType: string; data: Buffer }> {
	if (mimetype === "image/gif") {
		return { data: buf, contentType: "image/gif" };
	}

	const data = await sharp(buf)
		.resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();

	return { data, contentType: "image/webp" };
}

export const ACTION_ChangeBanner = MakeAction(
	"CHANGE_BANNER",
	async (taker, { "!fileBuffer": fileBuffer, fileMimetype }) => {
		if (
			fileMimetype === "image/jpeg" ||
			fileMimetype === "image/png" ||
			fileMimetype === "image/gif"
		) {
			const { data: storedBuffer, contentType } = await resizeBanner(fileBuffer, fileMimetype);
			const contentHash = HashSHA256(storedBuffer);

			await CDNStoreWithMeta(
				GetProfileBannerURL(taker.acct.id, contentHash),
				storedBuffer,
				{
					contentType,
					cacheControl: "public, max-age=31536000, immutable",
				},
			);

			await DB.updateTable("account")
				.set({ custom_banner_location: contentHash })
				.where("id", "=", taker.acct.id)
				.execute();

			return { contentHash };
		}

		// GIF is deliberately not mentioned here as it's an easter egg
		throw new ExpectedErr(400, "Invalid file - only JPG and PNG files are supported.");
	},
);
