import QuickTooltip from "#components/layout/misc/QuickTooltip";
import MiniTable from "#components/tables/components/MiniTable";
import ScoreCoreCells from "#components/tables/game-core-cells/ScoreCoreCells";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameProps } from "#types/react";
import { type FolderDataset } from "#types/tables";
import { ChangeOpacity } from "#util/color-opacity";
import { ONE_WEEK } from "#util/constants/time";
import { CreateChartLink } from "#util/data";
import { NumericSOV } from "#util/sorts";
import React, { useLayoutEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
	FormatChart,
	type GameConfig,
	GetGameConfig,
	GetScoreMetricConf,
	IIDX_LAMPS,
	type SessionDocument,
	type SessionScoreInfo,
	type UserDocument,
	type V3Game,
} from "tachi-common";

type Props = {
	enumMetric: string;
	folderDataset: FolderDataset;
	reqUser: UserDocument;
} & GameProps;

export default function FolderMinimap(props: Props) {
	const { data, isLoading, error } = useApiQuery<{
		scoreInfo: Array<SessionScoreInfo>;
		session: SessionDocument;
	}>(`/users/${props.reqUser.id}/games/${props.game}/sessions/last`);

	const session = useMemo(() => {
		if (error && error.statusCode === 404) {
			return null;
		} else if (data) {
			return data;
		}

		return null;
	}, [data, error]);

	if (error && error.statusCode !== 404) {
		return <ApiError error={error} />;
	}

	if (isLoading) {
		return <Loading />;
	}

	return (
		<>
			<div className="d-none d-lg-block">
				<FolderMinimapMain {...props} recentSession={session} />
			</div>
			<div className="d-block d-lg-none">
				Sadly, Switchboard view doesn't work on mobile at the moment.
			</div>
		</>
	);
}

function FolderMinimapMain({
	game,
	folderDataset,
	enumMetric,
	recentSession,
}: {
	recentSession: { scoreInfo: Array<SessionScoreInfo>; session: SessionDocument } | null;
} & Props) {
	const gameConfig = GetGameConfig(game);

	const getterFn = useMemo<(f: FolderDataset[0]) => number | undefined>(() => {
		const conf = GetScoreMetricConf(gameConfig, enumMetric);

		if (!conf) {
			return () => 0; // wut
		}

		if (conf.type === "ENUM") {
			// @ts-expect-error insane dynamic access
			return (c) => c.__related.pb?.scoreData.enumIndexes[enumMetric];
		}

		// @ts-expect-error insane dynamic access
		return (c) => c.__related.pb?.scoreData[enumMetric];
	}, [enumMetric]);

	const sortedDataset = useMemo(
		() => folderDataset.slice(0).sort(NumericSOV((a) => getterFn(a) ?? -Infinity, true)),
		[getterFn, folderDataset, enumMetric],
	);

	// For the switchboard chart, display a raise icon on stuff the user has recently played.
	const recentlyTouched = useMemo(() => {
		if (!recentSession || Date.now() - recentSession.session.timeEnded > ONE_WEEK) {
			return [];
		}

		return recentSession.scoreInfo
			.filter((e) => {
				if (e.isNewScore) {
					return true;
				}

				for (const v of Object.values(e.deltas)) {
					if (v >= 0) {
						return true;
					}
				}

				return false;
			})
			.map((e) => e.scoreID);
	}, [recentSession]);

	// Switchboard tabs / unmount can leave portalled Bootstrap tooltips in <body> while React
	// state still has show=true; drop those nodes so nothing sticks.
	useLayoutEffect(
		() => () => {
			document.querySelectorAll(".tooltip-folder-minimap").forEach((el) => {
				el.remove();
			});
		},
		[enumMetric],
	);

	return (
		<div className="row">
			<div className="col-12 col-lg-10 offset-lg-1">
				<div className="scoreinfo-grid-minimap" key={enumMetric}>
					{sortedDataset.map((d) => (
						<MinimapElement
							data={d}
							enumMetric={enumMetric}
							game={game}
							gameConfig={gameConfig}
							key={d.chartID}
							wasRecent={
								(d.__related.pb &&
									recentlyTouched.some((scoreID) =>
										d.__related.pb!.composedFrom.find(
											(e) => e.scoreID === scoreID,
										),
									)) ??
								false
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function MinimapElement({
	data,
	gameConfig,
	enumMetric,
	game,
	wasRecent,
}: {
	data: FolderDataset[0];
	enumMetric: string;
	game: V3Game;
	gameConfig: GameConfig;
	wasRecent: boolean;
}) {
	const gptImpl = GAME_CLIENT_IMPLEMENTATIONS[game];

	let icon = "level-up-alt";

	// @easteregg
	// if this user recently cleared mare nectaris
	// give them a pleasant treat
	if (
		data.chartID === "924bf011fdd8334b609b02e382123f9f5440d16d" &&
		data.__related.pb &&
		// @ts-expect-error the above chartID guarantees mare nectaris
		data.__related.pb?.scoreData.enumIndexes.lamp >= IIDX_LAMPS.EASY_CLEAR
	) {
		icon = "hand-middle-finger";
	}

	const colour = useMemo(() => {
		if (!data.__related.pb) {
			return null;
		}

		// @ts-expect-error unhinged dynamic access (i dont care)
		return gptImpl.enumColours[enumMetric][data.__related.pb.scoreData[enumMetric]];
	}, [data.__related.pb, gameConfig, enumMetric]);

	return (
		<QuickTooltip
			delay={{ hide: 0, show: 0 }}
			keepOpenWhenHoveringTooltip={false}
			tooltipClassName="tooltip-folder-minimap"
			tooltipContent={
				<div className="folder-minimap-tooltip">
					<div className="folder-minimap-tooltip-title">{FormatChart(data)}</div>
					<Divider className="folder-minimap-tooltip-divider" />
					{wasRecent && (
						<div className="folder-minimap-tooltip-recent">
							<Icon className="folder-minimap-tooltip-recent-icon" type="arrow-up" />
							<span>Raised in your last session</span>
						</div>
					)}
					{data.__related.pb ? (
						<div className="folder-minimap-tooltip-score">
							<MiniTable>
								<tr>
									<ScoreCoreCells
										chart={data}
										game={game}
										score={data.__related.pb}
										short
									/>
								</tr>
							</MiniTable>
						</div>
					) : (
						<p className="folder-minimap-tooltip-empty mb-0">Not played</p>
					)}
				</div>
			}
		>
			<Link to={CreateChartLink(data)}>
				<div
					className={`scoreinfo-grid-minimap-element ${
						wasRecent ? "scoreinfo-grid-minimap-element-recent" : ""
					}`}
					style={{
						backgroundColor: colour ? ChangeOpacity(colour, 0.4) : undefined,
					}}
				>
					{wasRecent && (
						<span className={`fas fa-${icon}`} style={{ lineHeight: "19.5px" }}></span>
					)}
				</div>
			</Link>
		</QuickTooltip>
	);
}
