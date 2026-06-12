import type { UserGameTableReturns } from "#types/api-returns";

import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { useBucket } from "#components/util/useBucket";
import { useEffect, useMemo, useState } from "react";
import { GetGameConfig, type TableDocument } from "tachi-common";

import type { FolderTableScopedProps, UserGameFolderStats } from "./folderTableShared";

import TableEvolutionReplay from "./TableEvolutionReplay";
import TableFolderList from "./TableFolderList";

export default function TableFolderViewer({
	game,
	highlightFolderSlug,
	highlightRevealKey = 0,
	onFolderRowNavigate,
	reqUser,
	table,
}: {
	highlightFolderSlug?: string;
	highlightRevealKey?: number;
	onFolderRowNavigate?: () => void;
	table: TableDocument;
} & FolderTableScopedProps) {
	const { data, error } = useApiQuery<UserGameTableReturns>(
		`/users/${reqUser.id}/games/${game}/tables/${table.tableID}`,
	);

	const bucket = useBucket(game);
	const [enumMetric, setEnumMetric] = useState(bucket);

	useEffect(() => {
		setEnumMetric(bucket);
	}, [bucket, table.tableID]);

	const [dataMap, setDataMap] = useState<Map<string, UserGameFolderStats>>(new Map());
	const [hasLoadedFolderMap, setHasLoadedFolderMap] = useState(false);

	useEffect(() => {
		if (data) {
			const statMap = new Map();
			for (const stat of data.stats) {
				statMap.set(stat.slug, stat);
			}

			const newMap = new Map();
			for (const folder of data.folders) {
				const stats = statMap.get(folder.slug)!;
				newMap.set(folder.slug, { folder, stats });
			}
			setDataMap(newMap);
			setHasLoadedFolderMap(true);
		}
	}, [data]);

	const gameConfig = useMemo(() => GetGameConfig(game), [game]);

	const evolutionScope = useMemo(() => ({ kind: "table" as const, table }), [table]);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data || !hasLoadedFolderMap) {
		return <Loading />;
	}

	return (
		<>
			<TableEvolutionReplay
				controlledEnumMetric={[enumMetric, setEnumMetric]}
				game={game}
				gameConfig={gameConfig}
				reqUser={reqUser}
				scope={evolutionScope}
			/>
			<Divider className="my-0 border-2" />
			<TableFolderList
				dataMap={dataMap}
				enumMetric={enumMetric}
				game={game}
				highlightFolderSlug={highlightFolderSlug}
				highlightRevealKey={highlightRevealKey}
				onFolderRowNavigate={onFolderRowNavigate}
				reqUser={reqUser}
				table={table}
			/>
		</>
	);
}
