import crypto from "crypto";

export function HashSHA256(content: Buffer) {
	return crypto.createHash("sha256").update(content).digest("hex");
}
