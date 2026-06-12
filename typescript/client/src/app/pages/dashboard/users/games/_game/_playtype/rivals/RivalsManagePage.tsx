import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import UserSelectModal from "#components/util/modal/UserSelectModal";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import UserIcon from "#components/util/UserIcon";
import { UserContext } from "#context/UserContext";
import { APIFetchV1 } from "#util/api";
import { SendErrorToast } from "#util/toaster";
import { useContext, useState } from "react";
import { Alert, Button, Col } from "react-bootstrap";
import { Prompt } from "react-router-dom";
import {
	FormatGame,
	GameToGameGroup,
	GetGameGroupConfig,
	type integer,
	type UserDocument,
	type V3Game,
} from "tachi-common";

export default function RivalsManagePage({
	reqUser,
	game,
}: {
	game: V3Game;
	reqUser: UserDocument;
}) {
	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Rivals",
			"Manage",
		],
		[reqUser, game],
		`Managing ${reqUser.username}'s ${FormatGame(game)} Rivals`,
	);

	const { settings } = useLoggedInUserGameSettings();

	const { data, error } = useApiQuery<UserDocument[]>(
		`/users/${reqUser.id}/games/${game}/rivals`,
		{},
		[`fetch-rivals-${settings?.rivals.join(",")}`],
	);

	const {
		data: challengers,
		isLoading: cIsLoading,
		error: cError,
	} = useApiQuery<UserDocument[]>(`/users/${reqUser.id}/games/${game}/rivals/challengers`);

	if (error) {
		<ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (cError) {
		<ApiError error={cError} />;
	}

	if (cIsLoading || !challengers) {
		return <Loading />;
	}

	return (
		<RivalsOverviewPage
			challengers={challengers}
			game={game}
			initialRivals={data}
			reqUser={reqUser}
		/>
	);
}

function RivalsOverviewPage({
	reqUser,
	game,
	initialRivals,
	challengers,
}: {
	challengers: Array<UserDocument>;
	game: V3Game;
	initialRivals: Array<UserDocument>;
	reqUser: UserDocument;
}) {
	const { user } = useContext(UserContext);

	const isRequestingUser = reqUser.id === user?.id;

	const [rivals, setRivals] = useState(initialRivals);
	const [show, setShow] = useState(false);
	const { settings, setSettings } = useLoggedInUserGameSettings();

	const [currentRivals, setCurrentRivals] = useState(initialRivals);

	const { data: MAX_RIVALS, error } = useApiQuery<integer>("/config/max-rivals");

	if (error) {
		return <ApiError error={error} />;
	}

	if (!MAX_RIVALS) {
		return <Loading />;
	}

	if (!settings) {
		return <div>Looks like you're not signed in. How did you get to this page?</div>;
	}

	return (
		<>
			{isRequestingUser && currentRivals.toString() !== rivals.toString() && (
				<Alert className="vstack" variant="warning">
					<Prompt
						message={
							"You have unsaved changes, are you sure you want to leave this page?"
						}
					/>
					<p className="text-center fs-3">You have unsaved changes!</p>
					<hr />
					<Button
						onClick={async () => {
							const res = await APIFetchV1(
								`/users/${reqUser.id}/games/${game}/rivals`,
								{
									method: "PUT",
									body: JSON.stringify({
										rivalIDs: rivals.map((e) => e.id),
									}),
									headers: {
										"Content-Type": "application/json",
									},
								},
								true,
								true,
							);

							if (res.success) {
								setCurrentRivals(rivals);
								setSettings({
									...settings,
									rivals: rivals.map((e) => e.id),
								});
							}
						}}
						size="lg"
						variant="primary"
					>
						Save Changes
					</Button>
				</Alert>
			)}
			<Card header={`${isRequestingUser ? "Your" : `${reqUser.username}'s`} Rivals`}>
				<Col className="d-flex justify-content-center flex-wrap" xs={12}>
					{rivals.map((e) => (
						<UserIcon game={game} key={e.id} user={e}>
							<Button
								onClick={() => setRivals(rivals.filter((u) => u.id !== e.id))}
								variant="outline-danger"
							>
								<Icon type="trash" /> Remove
							</Button>
						</UserIcon>
					))}
					{rivals.length === 0 && (
						<Muted>
							{isRequestingUser ? "You haven't" : `${reqUser.username} hasn't`} set
							any rivals.
						</Muted>
					)}
				</Col>

				{isRequestingUser && (
					<>
						<Col xs={12}>
							<Divider />
						</Col>
						<Col className="d-flex justify-content-center" xs={12}>
							{rivals.length >= MAX_RIVALS ? (
								<Button disabled variant="secondary">
									Maximum Rivals Reached :(
								</Button>
							) : (
								<Button onClick={() => setShow(true)} variant="success">
									<Icon type="plus" /> Add Rival
								</Button>
							)}
						</Col>

						<UserSelectModal
							callback={(user) => {
								if (rivals.length >= MAX_RIVALS) {
									SendErrorToast(`Can't have more than ${MAX_RIVALS} rivals!`);
								} else {
									setRivals([...rivals, user]);

									if (rivals.length + 1 >= MAX_RIVALS) {
										setShow(false);
									}
								}
							}}
							excludeMsg="Added!"
							excludeSet={rivals.map((e) => e.id)}
							setShow={setShow}
							show={show}
							url={`/games/${game}/players`}
						/>
					</>
				)}
			</Card>

			<Divider />

			<Card
				header={
					<div className="text-center">
						<h3>
							{isRequestingUser ? "Your" : `${reqUser.username}'s`} Reverse Rivals
						</h3>
						{challengers.length !== 0 && (
							<>
								<Muted>
									These people have {isRequestingUser ? "you" : reqUser.username}{" "}
									rivalled!
								</Muted>
							</>
						)}
					</div>
				}
			>
				<Col className="d-flex justify-content-center flex-wrap" xs={12}>
					{challengers.map((e) => (
						<UserIcon game={game} key={e.id} user={e}>
							{isRequestingUser &&
								!rivals.map((e) => e.id).includes(e.id) &&
								(rivals.length < MAX_RIVALS ? (
									<Button
										onClick={() => setRivals([...rivals, e])}
										variant="outline-success"
									>
										<Icon type="plus" /> Rival Back
									</Button>
								) : (
									<Button disabled variant="outline-secondary">
										<Icon type="plus" /> At Max Rivals
									</Button>
								))}
						</UserIcon>
					))}
					{challengers.length === 0 &&
						(isRequestingUser ? (
							<Muted>
								Nobody is rivalling you :(. Why not ask around in the discord?
							</Muted>
						) : (
							<Muted>This user has nobody rivalling them :(</Muted>
						))}
				</Col>
			</Card>
		</>
	);
}
