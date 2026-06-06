import { type BMSTable, LoadBMSTable } from "bms-table-loader";

import type { BMSTableInfo } from "../constants/bms-tables";

const BMS_TABLE_META_RE = /<meta[\s]+name="bmstable"/u;

export type BmstableFetchResult = {
	headers: { get(name: string): string | null };
	ok: boolean;
	status: number;
	text(): Promise<string>;
	url: string;
};

export type BmstableFetch = (url: string) => Promise<BmstableFetchResult>;

export type LoadBmstableTableOptions = {
	skipRedirect?: boolean;
};

function isJsonTableHeader(contentType: string | null, text: string): boolean {
	if (contentType?.includes("application/json")) {
		return true;
	}

	return text.trimStart().startsWith("{");
}

function responseLooksLikeBmstablePage(text: string): boolean {
	return BMS_TABLE_META_RE.test(text);
}

/** Fetch a BMS table URL (following HTTP redirects) and verify the response is a BMS table. */
export async function resolveBMSTableUrl(
	url: string,
	fetchFn: BmstableFetch,
	opts?: LoadBmstableTableOptions,
): Promise<string> {
	if (opts?.skipRedirect) {
		return url;
	}

	const res = await fetchFn(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch BMS table URL ${url}: HTTP ${res.status}.`);
	}

	const text = await res.text();
	const resolvedHttpUrl = res.url;

	if (
		isJsonTableHeader(res.headers.get("content-type"), text) ||
		responseLooksLikeBmstablePage(text)
	) {
		return resolvedHttpUrl;
	}

	throw new Error(
		`BMS table URL ${url} (resolved to ${resolvedHttpUrl}) has no bmstable meta tag.`,
	);
}

/** Resolve redirects, load a BMS table, and verify its symbol matches {@link BMSTableInfo.prefix}. */
export async function ParseAndLoadBMSTable(
	tableInfo: BMSTableInfo,
	fetchFn: BmstableFetch,
	opts?: LoadBmstableTableOptions,
): Promise<{ loadUrl: string; table: BMSTable }> {
	const loadUrl = await resolveBMSTableUrl(tableInfo.url, fetchFn, opts);
	const table = await LoadBMSTable(loadUrl);

	if (table.head.symbol !== tableInfo.prefix) {
		throw new Error(
			`Table ${tableInfo.name} (${tableInfo.url}) has unexpected symbol: expected ${JSON.stringify(tableInfo.prefix)}, got ${JSON.stringify(table.head.symbol)}.`,
		);
	}

	return { loadUrl, table };
}
