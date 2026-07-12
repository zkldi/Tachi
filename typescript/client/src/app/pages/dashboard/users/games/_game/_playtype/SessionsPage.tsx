import useSetSubheader from "#components/layout/header/useSetSubheader";
import SessionCalendar from "#components/sessions/SessionCalendar";
import GenericSessionTable, {
	type SessionDataset,
} from "#components/tables/sessions/GenericSessionTable";
import DebounceSearch from "#components/util/DebounceSearch";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import LoadingWrapper from "#components/util/LoadingWrapper";
import SelectButton from "#components/util/SelectButton";
import { useSessionRatingAlg } from "#components/util/useScoreRatingAlg";
import { type GameProfileProps, type GameProps } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { NumericSOV } from "#util/sorts";
import React, { useState } from "react";
import { useQuery } from "react-query";
import {
	FormatGame,
	GameToGameGroup,
	GetGameGroupConfig,
	type SessionDocument,
	type UnsuccessfulAPIResponse,
	type UserDocument,
} from "tachi-common";

export default function SessionsPage({ reqUser, game }: GameProfileProps) {
	const [sessionSet, setSessionSet] = useState<"best" | "highlighted" | "recent">("best");
	const [search, setSearch] = useState("");

	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Sessions",
		],
		[reqUser],
		`${reqUser.username}'s ${FormatGame(game)} Sessions`,
	);

	const baseUrl = `/users/${reqUser.id}/games/${game}/sessions`;

	const rating = useSessionRatingAlg(game);

	const { data, error } = useQuery<SessionDataset, UnsuccessfulAPIResponse>(
		`${baseUrl}/${sessionSet}`,
		async () => {
			const res = await APIFetchV1<SessionDocument[]>(`${baseUrl}/${sessionSet}`);

			if (!res.success) {
				throw res;
			}

			return res.body
				.sort(
					sessionSet === "best"
						? NumericSOV((x) => x.calculatedData[rating] ?? 0, true)
						: NumericSOV((x) => x.timeEnded ?? 0, true),
				)
				.map((e, i) => ({
					...e,
					__related: { index: i },
				}));
		},
	);

	return (
		<div className="row">
			<div className="col-12">
				<SessionCalendar
					url={`/users/${reqUser.id}/games/${game}/sessions/calendar`}
					user={reqUser}
				/>
				<Divider />
			</div>
			<div className="col-12 text-center">
				<div className="btn-group d-flex justify-content-center mb-4">
					<SelectButton
						className="text-wrap"
						id="best"
						setValue={setSessionSet}
						value={sessionSet}
					>
						<Icon type="trophy" /> Best Sessions
					</SelectButton>
					<SelectButton
						className="text-wrap"
						id="recent"
						setValue={setSessionSet}
						value={sessionSet}
					>
						<Icon type="history" /> Recent Sessions
					</SelectButton>
					<SelectButton
						className="text-wrap"
						id="highlighted"
						setValue={setSessionSet}
						value={sessionSet}
					>
						<Icon type="star" /> Highlighted Sessions
					</SelectButton>
				</div>
			</div>
			<div className="col-12 mt-4">
				<DebounceSearch placeholder="Search all sessions..." setSearch={setSearch} />
			</div>
			<div className="col-12 mt-4">
				{search === "" ? (
					<LoadingWrapper {...{ error, dataset: data }}>
						<GenericSessionTable
							dataset={data!}
							game={game}
							indexCol={sessionSet === "best"}
							reqUser={reqUser}
						/>
					</LoadingWrapper>
				) : (
					<SearchSessionsTable {...{ game, reqUser, baseUrl, search }} />
				)}
			</div>
		</div>
	);
}

function SearchSessionsTable({
	search,
	game,
	reqUser,
	baseUrl,
}: { baseUrl: string; reqUser: UserDocument; search: string } & GameProps) {
	const { data, error } = useQuery<SessionDataset, UnsuccessfulAPIResponse>(
		`${baseUrl}?search=${search}`,
		async () => {
			const res = await APIFetchV1<SessionDocument[]>(`${baseUrl}?search=${search}`);

			if (!res.success) {
				throw res;
			}

			return res.body.map((e, i) => ({
				...e,
				__related: {
					index: i,
				},
			})) as SessionDataset;
		},
	);

	return (
		<LoadingWrapper {...{ error, dataset: data }}>
			<GenericSessionTable dataset={data!} game={game} reqUser={reqUser} />
		</LoadingWrapper>
	);
}
