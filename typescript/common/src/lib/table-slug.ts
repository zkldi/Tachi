export function NormalizeTableSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "");
}
