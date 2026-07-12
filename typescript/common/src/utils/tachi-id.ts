function randomHex(byteLength: number): string {
	const buf = new Uint8Array(byteLength);

	globalThis.crypto.getRandomValues(buf);

	let hex = "";
	for (let i = 0; i < buf.length; i++) {
		hex += buf[i]!.toString(16).padStart(2, "0");
	}

	return hex;
}

/**
 * Snowflake-style string IDs: `prefix` + hex(timestamp − epoch) + 8 hex chars (4 random bytes).
 * Used for chart, song, quest, folder, and table documents in seeds and APIs.
 */
export function tachiID(prefix: string, ts: number = Date.now(), epoch = 0): string {
	const dt = ts - epoch;
	const dtb = dt.toString(16);
	const rand = randomHex(4);

	return prefix + dtb + rand;
}

export function CreateChartID(ts: number = Date.now()): string {
	return tachiID("C", ts);
}

export function CreateQuestID(ts: number = Date.now()): string {
	return tachiID("Q", ts);
}

export function CreateSongID(ts: number = Date.now()): string {
	return tachiID("S", ts);
}

export function CreateFolderID(ts: number = Date.now()): string {
	return tachiID("F", ts);
}

export function CreateTableID(ts: number = Date.now()): string {
	return tachiID("T", ts);
}
