import FolderEnumDistributionBreakdown from "#app/pages/dashboard/users/games/_game/_playtype/folders/FolderEnumDistributionBreakdown";
import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { GPT_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type UGPTFolderSlugStatsReturns } from "#types/api-returns";
import { type GamePT } from "#types/react";
import React, { useMemo } from "react";
import { GetGameConfig, GetScoreMetrics, type UserDocument } from "tachi-common";

export default function FolderInfoHeader({
	folderSlug,
	folderTitle,
	game,
	onBreakdownEnumValueClick,
	reqUser,
}: {
	folderSlug: string;
	folderTitle: string;
	onBreakdownEnumValueClick?: (metricKey: string, enumValueLabel: string) => void;
	reqUser: UserDocument;
} & GamePT) {
	const folderStatsUrl = `/users/${reqUser.id}/games/${game}/folders/${folderSlug}/stats`;
	const {
		data: folderStatsBody,
		error: folderStatsError,
		isLoading: folderStatsLoading,
	} = useApiQuery<UGPTFolderSlugStatsReturns>(folderStatsUrl);

	const gameConfig = GetGameConfig(game);

	const enumMetrics = useMemo(() => GetScoreMetrics(gameConfig, "ENUM"), [gameConfig]);
	const enumColourMaps = GPT_CLIENT_IMPLEMENTATIONS[game].enumColours as
		| Record<string, Record<string, string>>
		| undefined;

	return (
		<Card header={`${reqUser.username}'s ${folderTitle} Breakdown`}>
			<div className="vstack gap-3">
				{folderStatsError ? (
					<ApiError error={folderStatsError} />
				) : folderStatsLoading ? (
					<Loading />
				) : (
					(() => {
						const liveFolderStats = folderStatsBody?.stats;
						if (liveFolderStats === null || liveFolderStats === undefined) {
							return (
								<small className="text-body-secondary">
									Could not load folder statistics.
								</small>
							);
						}
						return (
							<div className="row g-3">
								{enumMetrics.map((metric) => (
									<div
										className={
											enumMetrics.length === 1 ? "col-12" : "col-12 col-md-6"
										}
										key={metric}
									>
										<FolderEnumDistributionBreakdown
											clipToMinimumRelevance={false}
											colours={enumColourMaps?.[metric]}
											enumMetric={metric}
											game={game}
											gameConfig={gameConfig}
											onEnumBreakdownRowClick={
												onBreakdownEnumValueClick
													? (enumValueLabel: string) => {
															onBreakdownEnumValueClick(
																metric,
																enumValueLabel,
															);
														}
													: undefined
											}
											stats={liveFolderStats}
											suppressTopRule
										/>
									</div>
								))}
							</div>
						);
					})()
				)}
			</div>
		</Card>
	);
}
