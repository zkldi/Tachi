import type { ImportTypes, UserDocument } from "tachi-common";

import { type KtLogger, log } from "#lib/log/log";
import { FormatUserDoc } from "#utils/user";

export function CreateScoreLogger(
	user: UserDocument,
	importID: string,
	importType: ImportTypes,
): KtLogger {
	return log.child({
		context: ["Score Import", importType, FormatUserDoc(user)],
		importID,
	});
}
