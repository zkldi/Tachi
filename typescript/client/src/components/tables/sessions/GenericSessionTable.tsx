import { useSessionRatingAlg } from "#components/util/useScoreRatingAlg";
import { GetPBs } from "#util/data";
import { FormatGameSessionRating, UppercaseFirst } from "#util/misc";
import { NumericSOV, StrSOV } from "#util/sorts";
import { FormatDuration, FormatTime, MillisToSince } from "#util/time";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
	GetGameConfig,
	type integer,
	type SessionDocument,
	type SessionRatingAlgorithms,
	type SessionScoreInfo,
	type UserDocument,
	type V3Game,
} from "tachi-common";

import IndexCell from "../cells/IndexCell";
import SelectableRating from "../components/SelectableRating";
import TachiTable, { type Header, type ZTableTHProps } from "../components/TachiTable";

export type SessionDataset = ({
	/** Present when API attaches per-score PB deltas (list views omit this). */
	__related: { index: integer; scoreInfo?: Array<SessionScoreInfo> };
} & SessionDocument)[];

export default function GenericSessionTable({
	dataset,
	indexCol = false,
	reqUser,
	game,
}: {
	dataset: SessionDataset;
	game: V3Game;
	indexCol?: boolean;
	reqUser: UserDocument;
}) {
	const gameConfig = GetGameConfig(game);

	const defaultRating = useSessionRatingAlg(game);

	const [alg, setAlg] = useState<SessionRatingAlgorithms[V3Game]>(defaultRating);

	const headers: Header<SessionDataset[0]>[] = [
		["Name", "Name", StrSOV((x) => x.name)],
		["Scores", "Scores", NumericSOV((x) => x.scoreIDs.length)],
		[UppercaseFirst(alg), UppercaseFirst(alg), NumericSOV((x) => x.calculatedData[alg] ?? 0)],
		["Duration", "Dur.", NumericSOV((x) => x.timeEnded - x.timeStarted)],
		["Timestamp", "Timestamp", NumericSOV((x) => x.timeStarted)],
	];

	if (Object.keys(gameConfig.sessionRatingAlgs).length > 1) {
		headers[2] = [
			"Rating",
			"Rating",
			NumericSOV((x) => x.calculatedData[alg] ?? 0),
			(thProps: ZTableTHProps) => (
				<SelectableRating
					game={game}
					key={game}
					mode="session"
					rating={alg}
					setRating={setAlg}
					{...thProps}
				/>
			),
		];
	}

	if (indexCol) {
		headers.unshift(["#", "#", NumericSOV((x) => x.__related.index)]);
	}

	return (
		<TachiTable
			dataset={dataset}
			entryName="Sessions"
			headers={headers}
			rowFunction={(s) => (
				<Row
					data={s}
					indexCol={indexCol}
					key={s.sessionID}
					ratingAlg={alg}
					reqUser={reqUser}
				/>
			)}
			searchFunctions={{
				name: (x) => x.name,
				scores: (x) => x.scoreIDs.length,
				duration: (x) => (x.timeEnded - x.timeStarted) / (1000 * 60),
				timestamp: (x) => x.timeStarted,
				[alg]: (x) => x.calculatedData[alg] ?? 0,
			}}
		/>
	);
}

function Row({
	data,
	ratingAlg,
	reqUser,
	indexCol = false,
}: {
	data: SessionDataset[0];
	indexCol?: boolean;
	ratingAlg: SessionRatingAlgorithms[V3Game];
	reqUser: UserDocument;
}) {
	const game = data.game;

	return (
		<tr className={data.highlight ? "highlighted-row" : ""}>
			{indexCol && <IndexCell index={data.__related.index} />}
			<td style={{ minWidth: "140px" }}>
				<Link
					className="text-decoration-none"
					to={`/u/${reqUser.username}/games/${game}/sessions/${data.sessionID}`}
				>
					{data.name}
				</Link>
				<br />
				<small className="text-body-secondary">{data.desc}</small>
			</td>
			<td>
				{data.scoreIDs.length}
				<br />
				<small className="text-body-secondary">
					{data.__related?.scoreInfo && `PBs: ${GetPBs(data.__related.scoreInfo).length}`}
				</small>
			</td>
			<td>{FormatGameSessionRating(game, ratingAlg, data.calculatedData[ratingAlg])}</td>
			<td>{FormatDuration(data.timeEnded - data.timeStarted)}</td>
			<td>
				{MillisToSince(data.timeStarted)}
				<br />
				<small className="text-body-secondary">{FormatTime(data.timeStarted)}</small>
			</td>
		</tr>
	);
}
