import { describe, expect, it } from "vitest";

import { type BmstableFetch, resolveBMSTableUrl } from "./bmstable-load";

function mockFetch(response: {
	body: string;
	contentType?: string;
	ok?: boolean;
	status?: number;
	url?: string;
}): BmstableFetch {
	return async (url) => ({
		ok: response.ok ?? true,
		status: response.status ?? 200,
		url: response.url ?? url,
		headers: { get: () => response.contentType ?? "text/html" },
		text: async () => response.body,
	});
}

describe("resolveBmstableTableUrl", () => {
	it("accepts HTML with a bmstable meta tag", async () => {
		const html = '<html><head><meta name="bmstable" content="{}"></head></html>';

		await expect(
			resolveBMSTableUrl(
				"https://example.com/table/",
				mockFetch({ body: html, url: "https://example.com/table/final" }),
			),
		).resolves.toBe("https://example.com/table/final");
	});

	it("accepts JSON table headers", async () => {
		await expect(
			resolveBMSTableUrl(
				"https://example.com/header.json",
				mockFetch({
					body: '{"symbol":"★"}',
					contentType: "application/json",
				}),
			),
		).resolves.toBe("https://example.com/header.json");
	});

	it("rejects HTML without a bmstable meta tag", async () => {
		await expect(
			resolveBMSTableUrl(
				"https://example.com/moved/",
				mockFetch({ body: "<html><script>window.location.replace('x')</script></html>" }),
			),
		).rejects.toThrow(/no bmstable meta tag/u);
	});

	it("returns the input URL when skipRedirect is set", async () => {
		await expect(
			resolveBMSTableUrl("https://example.com/table/", mockFetch({ body: "" }), {
				skipRedirect: true,
			}),
		).resolves.toBe("https://example.com/table/");
	});
});
