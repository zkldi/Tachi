import Icon from "#components/util/Icon";
import { UserContext } from "#context/UserContext";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { GetGameConfig, type TableDocument } from "tachi-common";

import FolderEnumProgressBar from "./FolderEnumProgressBar";
import folderTableStyles from "./FolderTablePage.module.scss";
import {
	type FolderTableScopedProps,
	tableFolderSlugsDisplayOrder,
	type UGPTFolderStats,
} from "./folderTableShared";

export default function TableFolderList({
	dataMap,
	enumMetric,
	game,
	highlightFolderSlug,
	highlightRevealKey = 0,
	onFolderRowNavigate,
	reqUser,
	table,
}: {
	dataMap: Map<string, UGPTFolderStats>;
	enumMetric: string;
	highlightFolderSlug?: string;
	highlightRevealKey?: number;
	onFolderRowNavigate?: () => void;
	table: TableDocument;
} & FolderTableScopedProps) {
	const gameConfig = useMemo(() => GetGameConfig(game), [game]);

	const enumColours = useMemo(
		() =>
			(
				GPT_CLIENT_IMPLEMENTATIONS[game].enumColours as
					| Record<string, Record<string, string>>
					| undefined
			)?.[enumMetric],
		[enumMetric, game],
	);

	const dataset = useMemo(() => {
		const arr = [];
		for (const folder of tableFolderSlugsDisplayOrder(table, game)) {
			const data = dataMap.get(folder);

			if (!data) {
				continue;
			}

			arr.push(data);
		}

		return arr;
	}, [dataMap, table, game]);

	const { user } = useContext(UserContext);

	return (
		<div className="mt-4">
			{dataset.length === 0 ? (
				<div className="text-center text-body-secondary py-5">No folders.</div>
			) : (
				dataset.map((data) => {
					const isFolderOpen = highlightFolderSlug === data.folder.slug;
					const linkKey =
						isFolderOpen && highlightRevealKey > 0
							? `${data.folder.slug}--hilite--${highlightRevealKey}`
							: data.folder.slug;

					return (
						<Link
							className={`${folderTableStyles.folderRow} bg-body-tertiary bg-opacity-25${
								isFolderOpen ? ` ${folderTableStyles.folderRowHighlighted}` : ""
							}`}
							key={linkKey}
							onClick={() => {
								if (user?.id === reqUser.id) {
									APIFetchV1(
										`/users/${reqUser.id}/games/${game}/folders/${data.folder.slug}/viewed`,
										{
											method: "POST",
										},
									);
								}

								onFolderRowNavigate?.();
							}}
							to={`/u/${reqUser.username}/games/${game}/folders/${data.folder.slug}`}
						>
							<div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2 gap-lg-3">
								<div
									className={`fw-semibold text-truncate ${folderTableStyles.folderRowTitle}`}
								>
									{data.folder.title}
								</div>
								<div className="flex-grow-1 min-w-0" style={{ minWidth: "10rem" }}>
									<FolderEnumProgressBar
										colours={enumColours}
										enumMetric={enumMetric}
										gameConfig={gameConfig}
										key={`${enumMetric}-${data.folder.slug}`}
										stats={data.stats}
									/>
								</div>
								<div
									className={`d-flex align-items-center ms-lg-auto ${folderTableStyles.folderRowChartMeta}`}
								>
									<span
										className={`text-body-secondary ${folderTableStyles.folderRowChartCount}`}
									>
										{data.stats.chartCount}
									</span>
									<Icon
										aria-hidden
										className="text-body-secondary opacity-75"
										type="chevron-right"
									/>
								</div>
							</div>
						</Link>
					);
				})
			)}
		</div>
	);
}
