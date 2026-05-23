import { MakeAction } from "#lib/actions/actions";
import { CDNStoreWithMeta } from "#lib/cdn/cdn";
import { GetProfilePictureURL } from "#lib/cdn/url-format";
import DB from "#services/pg/db";
import { HashSHA256 } from "#utils/crypto";
import { ExpectedErr } from "bliss";
import sharp from "sharp";

/** Max dimension (width or height) for stored profile pictures. */
const PFP_MAX_PX = 256;

/**
 * Resizes a JPEG or PNG buffer to at most PFP_MAX_PX × PFP_MAX_PX and
 * re-encodes as WebP. GIFs are returned unchanged to preserve animations.
 */
async function resizePfp(
	buf: Buffer,
	mimetype: string,
): Promise<{ contentType: string; data: Buffer }> {
	if (mimetype === "image/gif") {
		return { data: buf, contentType: "image/gif" };
	}

	const data = await sharp(buf)
		.resize(PFP_MAX_PX, PFP_MAX_PX, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();

	return { data, contentType: "image/webp" };
}

export const ACTION_ChangePfp = MakeAction(
	"CHANGE_PFP",
	async (taker, { "!fileBuffer": fileBuffer, fileMimetype }) => {
		if (
			fileMimetype === "image/jpeg" ||
			fileMimetype === "image/png" ||
			fileMimetype === "image/gif"
		) {
			const { data: storedBuffer, contentType } = await resizePfp(fileBuffer, fileMimetype);
			const contentHash = HashSHA256(storedBuffer);

			await CDNStoreWithMeta(GetProfilePictureURL(taker.acct.id, contentHash), storedBuffer, {
				contentType,
				cacheControl: "public, max-age=31536000, immutable",
			});

			await DB.updateTable("account")
				.set({ custom_pfp_location: contentHash })
				.where("id", "=", taker.acct.id)
				.execute();

			return { contentHash };
		}

		// GIF is deliberately not mentioned here as it's an easter egg
		throw new ExpectedErr(400, "Invalid file - only JPG and PNG files are supported.");
	},
);
