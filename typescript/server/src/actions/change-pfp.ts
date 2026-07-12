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
 * Resizes any image (including animated GIFs) to at most PFP_MAX_PX × PFP_MAX_PX
 * and re-encodes as WebP, preserving all animation frames.
 */
async function resizePfp(buf: Buffer): Promise<Buffer> {
	return sharp(buf, { animated: true })
		.resize(PFP_MAX_PX, PFP_MAX_PX, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 85 })
		.toBuffer();
}

export const ACTION_ChangePfp = MakeAction(
	"CHANGE_PFP",
	async (taker, { "!fileBuffer": fileBuffer, fileMimetype }) => {
		if (
			fileMimetype !== "image/jpeg" &&
			fileMimetype !== "image/png" &&
			fileMimetype !== "image/gif"
		) {
			// GIF is deliberately not mentioned in the error message as it's an easter egg
			throw new ExpectedErr(400, "Invalid file - only JPG and PNG files are supported.");
		}

		const storedBuffer = await resizePfp(fileBuffer);
		const contentHash = HashSHA256(storedBuffer);

		await CDNStoreWithMeta(GetProfilePictureURL(taker.acct.id, contentHash), storedBuffer, {
			contentType: "image/webp",
			cacheControl: "public, max-age=31536000, immutable",
		});

		await DB.updateTable("account")
			.set({ custom_pfp_location: contentHash })
			.where("id", "=", taker.acct.id)
			.execute();

		return { contentHash };
	},
);
