import Activity from "#components/activity/Activity";
import ChartTooltip from "#components/charts/ChartTooltip";
import TimelineChart from "#components/charts/TimelineChart";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import UGPTStatShowcase from "#components/user/UGPTStatShowcase";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import Select from "#components/util/Select";
import SelectButton from "#components/util/SelectButton";
import { useProfileRatingAlg } from "#components/util/useScoreRatingAlg";
import { type UGPTHistory } from "#types/api-returns";
import { type GamePT, type SetState, type UGPT } from "#types/react";
import {
	FormatGPTProfileRating,
	FormatGPTProfileRatingName,
	getProfileRatingAlgKeysInDisplayOrder,
	UppercaseFirst,
} from "#util/misc";
import { FormatDate, MillisToSince } from "#util/time";
import { DateTime } from "luxon";
import React, { useMemo, useState } from "react";
import FormSelect from "react-bootstrap/FormSelect";
import { FormatGame, GetGameConfig, type UserGameStats, type V3Game } from "tachi-common";

export default function OverviewPage({ reqUser, game }: UGPT) {
	useSetSubheader(
		["Users", reqUser.username, "Games", FormatGame(game)],
		[reqUser, game],
		`${reqUser.username}'s ${FormatGame(game)} Overview`,
	);

	return (
		<React.Fragment key={game}>
			<UGPTStatShowcase game={game} reqUser={reqUser} />
			<RankingInfo game={game} reqUser={reqUser} />
			<RecentActivity game={game} reqUser={reqUser} />
		</React.Fragment>
	);
}

function RecentActivity({ reqUser, game }: UGPT) {
	return (
		<div className="mt-4">
			<Activity handleNoActivity={null} url={`/users/${reqUser.id}/games/${game}/activity`} />
		</div>
	);
}

type RankingDurations = "3mo" | "all" | "month" | "week" | "year";

function RankingInfo({ reqUser, game }: UGPT) {
	const [duration, setDuration] = useState<RankingDurations>("3mo");

	const { data, error } = useApiQuery<UGPTHistory>(
		`/users/${reqUser.id}/games/${game}/history?duration=${duration}`,
	);

	return (
		<Card className="mt-4" header={`${reqUser.username}'s History`}>
			{error ? (
				<ApiError error={error} />
			) : data ? (
				<UserHistory
					data={data}
					duration={duration}
					game={game}
					setDuration={setDuration}
				/>
			) : (
				<Loading />
			)}
		</Card>
	);
}

function UserHistory({
	data,
	game,
	duration,
	setDuration,
}: {
	data: UGPTHistory;
	duration: RankingDurations;
	setDuration: SetState<RankingDurations>;
} & GamePT) {
	const gameConfig = GetGameConfig(game);

	const [mode, setMode] = useState<"playcount" | "ranking" | "rating">("rating");

	const preferredRating = useProfileRatingAlg(game);

	const [rating, setRating] = useState<keyof UserGameStats["ratings"]>(preferredRating);

	const propName = useMemo(() => {
		if (mode === "rating" && rating) {
			return FormatGPTProfileRatingName(game, rating);
		} else if (mode === "ranking") {
			return `${FormatGPTProfileRatingName(game, rating)} Ranking`;
		}

		return UppercaseFirst(mode);
	}, [mode, rating, game]);

	const currentPropValue = useMemo(() => {
		if (mode === "rating" && rating) {
			const ratingValue = data[0].ratings[rating];

			if (!ratingValue) {
				return "N/A";
			}

			return FormatGPTProfileRating(game, rating, ratingValue);
		} else if (mode === "ranking") {
			return (
				<>
					#{data[0].rankings[rating]?.ranking ?? "ERR!"}
					<Muted>/{data[0].rankings[rating]?.outOf ?? "ERR!"}</Muted>
				</>
			);
		}

		return data[0].playcount;
	}, [mode, rating, data, game]);

	return (
		<>
			<div className="row d-flex justify-content-center mb-4">
				<div className="col-12 col-md-3 align-self-center text-center">
					<Select className="mb-4 mb-md-0" setValue={setDuration} value={duration}>
						<option value="week">Past Week</option>
						<option value="month">Past Month</option>
						<option value="3mo">Past 3 Months</option>
						<option value="year">Past Year</option>
						<option value="all">All Time</option>
					</Select>
				</div>
				<div className="col-12 col-md-6 align-self-center">
					<div className="btn-group d-flex justify-content-center w-100">
						<SelectButton id="ranking" setValue={setMode} value={mode}>
							<Icon type="trophy" /> Ranking
						</SelectButton>
						<SelectButton id="playcount" setValue={setMode} value={mode}>
							<Icon type="gamepad" /> Playcount
						</SelectButton>
						<SelectButton id="rating" setValue={setMode} value={mode}>
							<Icon type="chart-line" /> Ratings
						</SelectButton>
					</div>
				</div>
				<div className="col-12 d-block d-md-none mb-4"></div>
				<div className="col-12 col-md-3 text-center">
					<div className="mb-4">Current {propName}</div>
					<div>
						<span className="display-4">{currentPropValue}</span>
					</div>
				</div>
			</div>
			<Divider className="mt-6 mb-2" />
			{mode === "ranking" ? (
				<>
					{getProfileRatingAlgKeysInDisplayOrder(game).length > 1 && (
						<div className="col-12 offset-md-4 col-md-4 mt-4">
							<FormSelect
								onChange={(e) =>
									setRating(e.target.value as keyof UserGameStats["ratings"])
								}
								value={rating}
							>
								{getProfileRatingAlgKeysInDisplayOrder(game).map((e) => (
									<option key={e} value={e}>
										{FormatGPTProfileRatingName(game, e)}
									</option>
								))}
							</FormSelect>
						</div>
					)}
					<RankingTimeline data={data} rating={rating} />
				</>
			) : mode === "playcount" ? (
				<TimelineChart
					areaBaselineValue={Math.min(...data.map((e) => e.playcount))}
					axisBottom={{
						format: (x) => DateTime.fromJSDate(x).toLocaleString(DateTime.DATE_FULL),
						tickValues: 3,
					}}
					axisLeft={{
						tickSize: 5,
						tickPadding: 5,
						tickRotation: 0,
						format: (y) => (Number.isInteger(y) ? y : ""),
					}}
					curve="linear"
					data={[
						{
							id: "playcount",
							data: data.map((d) => ({ x: d.timestamp, y: d.playcount })),
						},
					]}
					enableArea={true}
					height="30rem"
					mobileHeight="20rem"
					tooltip={(p) => (
						<ChartTooltip>
							{p.point.data.yFormatted} Play{p.point.data.yFormatted !== "1" && "s"}
							<br />
							<small className="text-body-secondary">
								{MillisToSince(+p.point.data.xFormatted)}
							</small>
						</ChartTooltip>
					)}
				/>
			) : (
				<>
					{getProfileRatingAlgKeysInDisplayOrder(game).length > 1 && (
						<div className="col-12 offset-md-4 col-md-4 mt-4">
							<FormSelect
								onChange={(e) =>
									setRating(e.target.value as keyof UserGameStats["ratings"])
								}
								value={rating}
							>
								{getProfileRatingAlgKeysInDisplayOrder(game).map((e) => (
									<option key={e} value={e}>
										{FormatGPTProfileRatingName(game, e)}
									</option>
								))}
							</FormSelect>
						</div>
					)}

					<RatingTimeline {...{ game, data, rating }} />
				</>
			)}
		</>
	);
}

function RatingTimeline({
	game,
	data,
	rating,
}: {
	data: UGPTHistory;
	game: V3Game;
	rating: keyof UserGameStats["ratings"];
}) {
	const ratingDataset = [
		{ id: rating, data: data.map((e) => ({ x: e.timestamp, y: e.ratings[rating] })) },
	];

	return (
		<TimelineChart
			axisBottom={{
				format: (x) => DateTime.fromJSDate(x).toLocaleString(DateTime.DATE_FULL),
				tickValues: 3,
			}}
			axisLeft={{
				tickSize: 5,
				tickPadding: 5,
				tickRotation: 0,
				format: (y) => (y ? FormatGPTProfileRating(game, rating, y) : "N/A"),
			}}
			data={ratingDataset}
			height="30rem"
			mobileHeight="20rem"
			tooltip={(p) => (
				<ChartTooltip>
					<div>
						{p.point.data.y
							? FormatGPTProfileRating(game, rating, p.point.data.y as number)
							: "N/A"}{" "}
						{FormatGPTProfileRatingName(game, rating)}
					</div>
					<small className="text-body-secondary">
						{MillisToSince(+p.point.data.xFormatted)}
					</small>
				</ChartTooltip>
			)}
		/>
	);
}

function RankingTimeline({
	data,
	rating,
}: {
	data: UGPTHistory;
	rating: keyof UserGameStats["ratings"];
}) {
	return (
		<TimelineChart
			axisBottom={{
				format: (x) => DateTime.fromJSDate(x).toLocaleString(DateTime.DATE_FULL),
				tickValues: 3,
			}}
			axisLeft={{
				tickSize: 5,
				tickPadding: 5,
				tickRotation: 0,
				format: (y) => (Number.isInteger(y) ? `#${y}` : ""),
			}}
			data={[
				{
					id: "ranking",
					data: data.map((d) => ({ x: d.timestamp, y: d.rankings[rating]?.ranking })),
				},
			]}
			height="30rem"
			mobileHeight="20rem"
			reverse={true}
			tooltip={(p) => (
				<ChartTooltip>
					<div>
						{MillisToSince(+p.point.data.xFormatted)}: #{p.point.data.yFormatted}
					</div>
					<small className="text-body-secondary">
						({FormatDate(+p.point.data.xFormatted)})
					</small>
				</ChartTooltip>
			)}
		/>
	);
}
