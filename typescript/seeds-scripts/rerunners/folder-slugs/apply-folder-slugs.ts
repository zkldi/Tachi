import { computeFolderSlug, type SeedFolderRow } from "./folder-slug";

export function applyFolderSlugs(
	folders: Array<SeedFolderRow>,
	onlyGames: ReadonlySet<string> | null,
): {
	skippedAlreadySet: number;
	updated: number;
	updatedByGame: Record<string, number>;
} {
	let updated = 0;
	let skippedAlreadySet = 0;
	const updatedByGame: Record<string, number> = {};

	const slugKeys = new Map<string, string>();

	for (const folder of folders) {
		if (onlyGames !== null && !onlyGames.has(folder.game)) {
			continue;
		}

		const slug = computeFolderSlug(folder);
		const key = `${folder.game}\0${slug}`;

		if (slugKeys.has(key)) {
			throw new Error(
				`Duplicate slug "${slug}" for game ${folder.game}: "${slugKeys.get(key)}" vs "${folder.title}"`,
			);
		}

		slugKeys.set(key, folder.title);

		if (folder.slug === slug) {
			skippedAlreadySet++;
			continue;
		}

		folder.slug = slug;
		updated++;
		updatedByGame[folder.game] = (updatedByGame[folder.game] ?? 0) + 1;
	}

	return { updated, skippedAlreadySet, updatedByGame };
}
