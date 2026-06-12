import ErrorPage from "#app/pages/ErrorPage";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import UserGameStatContainer from "#components/user/UserGameStatContainer";
import UserGameStatCreator from "#components/user/UserGameStatCreator";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import { type UserGameData } from "#components/util/query/fetchUserGameData";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import useQueryString from "#components/util/useQueryString";
import { UserGameContext } from "#context/UserGameContext";
import { TachiConfig } from "#lib/config";
import { type GameProfileProps, type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import {
	FormatGameProfileRatingName,
	FormatGameScoreRatingName,
	FormatGameSessionRatingName,
	getProfileRatingAlgKeysInDisplayOrder,
	ToFixedFloor,
	UppercaseFirst,
} from "#util/misc";
import deepmerge from "deepmerge";
import { useFormik } from "formik";
import { useContext, useEffect, useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
	BMS_TABLES,
	FormatGame,
	GameToGameGroup,
	GetGameConfig,
	GetGameGroupConfig,
	GetScoreMetrics,
	type ShowcaseStatDetails,
	type TableDocument,
	type UserDocument,
	type UserGameSettingsDocument,
} from "tachi-common";

export default function UserGameSettingsPage({ reqUser, game }: GameProfileProps) {
	const query = useQueryString();

	const [page, setPage] = useState<"manage" | "preferences" | "showcase">(
		query.get("showcase") ? "showcase" : "preferences",
	);

	useSetSubheader(
		[
			"Users",
			reqUser.username,
			"Games",
			GetGameGroupConfig(GameToGameGroup(game)).name,
			"Settings",
		],
		[reqUser],
		`${reqUser.username}'s ${FormatGame(game)} Settings`,
	);

	const { loggedInData } = useContext(UserGameContext);
	if (!loggedInData) {
		return (
			<ErrorPage
				customMessage="You don't appear to have any settings for this game; have you played it?"
				statusCode={400}
			/>
		);
	}

	return (
		<Card className="col-12 offset-lg-2 col-lg-8" header="Settings">
			<div className="row">
				<div className="col-12 d-flex justify-content-center">
					<div className="btn-group">
						<SelectButton
							className="text-wrap"
							id="preferences"
							setValue={setPage}
							value={page}
						>
							<Icon type="cogs" /> Preferences
						</SelectButton>
						<SelectButton
							className="text-wrap"
							id="showcase"
							setValue={setPage}
							value={page}
						>
							<Icon type="bars" /> Showcase Stats
						</SelectButton>
						<SelectButton
							className="text-wrap"
							id="manage"
							setValue={setPage}
							value={page}
						>
							<Icon type="eraser" /> Manage Account
						</SelectButton>
					</div>
				</div>
				<div className="col-12">
					<Divider className="mt-4 mb-4" />
					{page === "preferences" ? (
						loggedInData.settings ? (
							<PreferencesForm
								game={game}
								loggedInData={{ ...loggedInData, settings: loggedInData.settings }}
								reqUser={reqUser}
							/>
						) : (
							<div className="text-center">
								<Muted>
									No game settings exist yet for this profile. Submit a score or
									import first, then return here.
								</Muted>
							</div>
						)
					) : page === "showcase" ? (
						loggedInData.settings ? (
							<ShowcaseForm
								game={game}
								loggedInData={{ ...loggedInData, settings: loggedInData.settings }}
								reqUser={reqUser}
							/>
						) : (
							<div className="text-center">
								<Muted>
									No game settings exist yet for this profile. Submit a score or
									import first, then return here.
								</Muted>
							</div>
						)
					) : (
						<ManageAccount game={game} reqUser={reqUser} />
					)}
				</div>
			</div>
		</Card>
	);
}

function PreferencesForm({
	reqUser,
	game,
	loggedInData,
}: { loggedInData: { settings: UserGameSettingsDocument } & UserGameData } & GameProfileProps) {
	const { setLoggedInData } = useContext(UserGameContext);

	const settings = loggedInData.settings;

	const gameConfig = GetGameConfig(game);

	const formik = useFormik({
		initialValues: {
			preferredScoreAlg:
				settings.preferences.preferredScoreAlg || gameConfig.defaultScoreRatingAlg,
			preferredProfileAlg:
				settings.preferences.preferredProfileAlg || gameConfig.defaultProfileRatingAlg,
			preferredSessionAlg:
				settings.preferences.preferredSessionAlg || gameConfig.defaultSessionRatingAlg,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			gameSpecific: settings.preferences.gameSpecific as any,
			defaultTable: settings.preferences.defaultTable,
			preferredDefaultEnum:
				settings.preferences.preferredDefaultEnum ?? gameConfig.preferredDefaultEnum,
			preferredRanking:
				settings.preferences.preferredRanking === "rival"
					? "global"
					: (settings.preferences.preferredRanking ?? "global"),
		},
		onSubmit: async (values) => {
			const rj = await APIFetchV1<UserDocument>(
				`/users/${reqUser.id}/games/${game}/settings`,
				{
					method: "PATCH",
					body: JSON.stringify(values),
					headers: {
						"Content-Type": "application/json",
					},
				},
				true,
				true,
			);

			if (rj.success) {
				setLoggedInData({
					...loggedInData,
					settings: deepmerge(settings as UserGameSettingsDocument, {
						preferences: values,
					}),
				});
			}
		},
	});

	const { data: tables, error } = useApiQuery<TableDocument[]>(
		`/games/${game}/tables?showInactive=true`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!tables) {
		return <Loading />;
	}

	const displayableTables = tables.filter(
		(e) => !e.inactive || settings.preferences.defaultTable === e.tableID,
	);

	const formGroupClassNames = "d-flex flex-column";

	return (
		<Form className="d-flex flex-column gap-4" onSubmit={formik.handleSubmit}>
			{Object.keys(gameConfig.scoreRatingAlgs).length > 1 && (
				<Form.Group className={formGroupClassNames}>
					<Form.Label>Preferred Score Algorithm</Form.Label>
					<Form.Select
						id="preferredScoreAlg"
						onChange={formik.handleChange}
						value={formik.values.preferredScoreAlg}
					>
						{Object.keys(gameConfig.scoreRatingAlgs).map((e) => (
							<option key={e} value={e}>
								{FormatGameScoreRatingName(game, e)}
							</option>
						))}
					</Form.Select>
					<Form.Text className="text-body-secondary">
						This configures the default rating algorithm to display for scores. This is
						used for things like score tables and PB tables.
					</Form.Text>
				</Form.Group>
			)}
			{Object.keys(gameConfig.sessionRatingAlgs).length > 1 && (
				<Form.Group className={formGroupClassNames}>
					<Form.Label>Preferred Session Algorithm</Form.Label>
					<Form.Select
						id="preferredSessionAlg"
						onChange={formik.handleChange}
						value={formik.values.preferredSessionAlg}
					>
						{Object.keys(gameConfig.sessionRatingAlgs).map((e) => (
							<option key={e} value={e}>
								{FormatGameSessionRatingName(game, e)}
							</option>
						))}
					</Form.Select>
					<Form.Text className="text-body-secondary">
						This configures the default rating algorithm to display for sessions. This
						is used for things like session tables.
					</Form.Text>
				</Form.Group>
			)}
			{getProfileRatingAlgKeysInDisplayOrder(game).length > 1 && (
				<Form.Group className={formGroupClassNames}>
					<Form.Label>Preferred Profile Algorithm</Form.Label>
					<Form.Select
						id="preferredProfileAlg"
						onChange={formik.handleChange}
						value={formik.values.preferredProfileAlg}
					>
						{getProfileRatingAlgKeysInDisplayOrder(game).map((e) => (
							<option key={e} value={e}>
								{FormatGameProfileRatingName(game, e)}
							</option>
						))}
					</Form.Select>
					<Form.Text className="text-body-secondary">
						This configures the default rating algorithm to display for profiles. This
						is used for things like leaderboards.
					</Form.Text>
				</Form.Group>
			)}
			<Form.Group className={formGroupClassNames}>
				<Form.Label>Preferred Folder Info</Form.Label>
				<Form.Select
					id="preferredDefaultEnum"
					onChange={formik.handleChange}
					value={formik.values.preferredDefaultEnum}
				>
					{GetScoreMetrics(gameConfig, "ENUM").map((e) => (
						<option key={e} value={e}>
							{UppercaseFirst(e)}
						</option>
					))}
				</Form.Select>
				<Form.Text className="text-body-secondary">
					What should {TachiConfig.NAME} default to showing you about folders?
				</Form.Text>
			</Form.Group>
			<Form.Group className={formGroupClassNames}>
				<Form.Label>Preferred Table</Form.Label>
				<Form.Select
					id="defaultTable"
					onChange={formik.handleChange}
					value={
						formik.values.defaultTable ??
						tables.find((x) => x.default)?.tableID ??
						displayableTables[0].tableID
					}
				>
					{displayableTables.map((table) => (
						<option key={table.tableID} value={table.tableID}>
							{table.title}
						</option>
					))}
				</Form.Select>
				<Form.Text className="text-body-secondary">
					What folders would you like to see by default?
				</Form.Text>
			</Form.Group>
			{(game === "iidx-sp" || game === "iidx-dp") && (
				<>
					<Form.Group className={formGroupClassNames}>
						<Form.Check
							checked={formik.values.gameSpecific.display2DXTra}
							id="gameSpecific.display2DXTra"
							label="Display 2DX-tra Charts"
							name="gameSpecific.display2DXTra"
							onChange={formik.handleChange}
							type="checkbox"
						/>
						<Form.Text className="text-body-secondary">
							Display 2DX-tra charts on the song page.
						</Form.Text>
					</Form.Group>
					<Form.Group className={formGroupClassNames}>
						<Form.Label>BPI Target</Form.Label>
						<Form.Control
							id="gameSpecific.bpiTarget"
							max={100}
							min={0}
							name="gameSpecific.bpiTarget"
							onChange={formik.handleChange}
							step={5}
							type="number"
							value={formik.values.gameSpecific.bpiTarget}
						/>
						<Form.Text className="text-body-secondary">
							Set yourself a BPI target. {TachiConfig.NAME} will show how far away you
							are from it in the UI!
						</Form.Text>
					</Form.Group>
				</>
			)}
			{(game === "sdvx" || game === "usc-controller" || game === "usc-keyboard") && (
				<Form.Group className={formGroupClassNames}>
					<Form.Label>VF6 Target</Form.Label>
					<Form.Control
						id="gameSpecific.vf6Target"
						max={0.5}
						min={0}
						name="gameSpecific.vf6Target"
						onChange={formik.handleChange}
						step={0.001}
						type="number"
						value={formik.values.gameSpecific.vf6Target}
					/>
					Expected Profile VF6{" "}
					{ToFixedFloor((formik.values.gameSpecific.vf6Target ?? 0) * 50, 2)}
					<Form.Text className="text-body-secondary">
						Set yourself a VF6 target. {TachiConfig.NAME} will show how far away you are
						from it in the UI!
						<br />
						Set this to 0 to disable the target.
					</Form.Text>
				</Form.Group>
			)}
			{(game === "bms-7k" || game === "bms-14k") && (
				<Form.Group className={formGroupClassNames}>
					<Form.Label>Preferred Tables</Form.Label>

					{BMS_TABLES.filter((e) => e.game === game).map((e) => (
						<Form.Check
							checked={
								formik.values.gameSpecific.displayTables?.includes(e.prefix) ??
								!e.notDefault
							}
							key={e.prefix}
							label={`(${e.prefix}) ${e.name}`}
							onChange={(event) => {
								const base: Array<string> =
									formik.values.gameSpecific.displayTables ??
									BMS_TABLES.filter((e) => e.game === game && !e.notDefault).map(
										(e) => e.prefix,
									);

								if (event.target.checked) {
									formik.setFieldValue("gameSpecific.displayTables", [
										...base,
										e.prefix,
									]);
								} else {
									formik.setFieldValue(
										"gameSpecific.displayTables",
										base.filter((a) => a !== e.prefix),
									);
								}
							}}
						/>
					))}

					<Form.Text className="text-body-secondary">
						What tables do you want to display in the UI? Use this to disable tables you
						don't really care for.
					</Form.Text>
				</Form.Group>
			)}
			<Button type="submit" variant="success">
				Save Changes
			</Button>
		</Form>
	);
}

function ShowcaseForm({
	reqUser,
	game,
	loggedInData,
}: { loggedInData: { settings: UserGameSettingsDocument } & UserGameData } & GameProfileProps) {
	const { setLoggedInData } = useContext(UserGameContext);

	const settings = loggedInData.settings;

	const [stats, setStats] = useState(settings.preferences.stats);
	const [show, setShow] = useState(false);

	const SaveChanges = async () => {
		const r = await APIFetchV1<UserGameSettingsDocument>(
			`/users/${reqUser.id}/games/${game}/showcase`,
			{
				method: "PUT",
				body: JSON.stringify({ showcase: stats }),
				headers: { "Content-Type": "application/json" },
			},
			true,
			true,
		);

		if (r.success) {
			setLoggedInData({
				...loggedInData,
				settings: r.body,
			});
		}
	};

	const [isFirstPaint, setIsFirstPaint] = useState(true);

	useEffect(() => {
		if (isFirstPaint) {
			setIsFirstPaint(false);
		} else {
			SaveChanges();
		}
	}, [stats]);

	return (
		<div className="d-flex flex-column gap-4 align-items-center">
			{stats.length < 6 && (
				<div>
					<Button onClick={() => setShow(true)} variant="info">
						Add Statistic
					</Button>
				</div>
			)}
			<RenderCurrentStats {...{ reqUser, game, stats, setStats }} />
			<UserGameStatCreator
				game={game}
				onCreate={(stat) => {
					setStats([...stats, stat]);
				}}
				reqUser={reqUser}
				setShow={setShow}
				show={show}
			/>
		</div>
	);
}

function RenderCurrentStats({
	stats,
	setStats,
	reqUser,
	game,
}: {
	setStats: SetState<ShowcaseStatDetails[]>;
	stats: ShowcaseStatDetails[];
} & GameProfileProps) {
	function RemoveStatAtIndex(index: number) {
		setStats(stats.filter((e, i) => i !== index));
	}

	if (stats.length === 0) {
		return (
			<div className="w-100 text-center">
				<Muted>You have no stats set, Why not set some?</Muted>
			</div>
		);
	}

	return (
		<Row className="w-100 row-gap-4" lg={{ cols: 2 }}>
			{stats.map((e, i) => (
				<Col className="d-flex flex-column gap-4" key={i}>
					<UserGameStatContainer game={game} reqUser={reqUser} stat={e} />
					<Button className="w-100" onClick={() => RemoveStatAtIndex(i)} variant="danger">
						Delete
					</Button>
				</Col>
			))}
		</Row>
	);
}

function ManageAccount({ reqUser, game }: GameProfileProps) {
	const [password, setPassword] = useState("");
	const [deleting, setDeleting] = useState(false);

	return (
		<Row>
			<Col xs={12}>
				<h4>Delete Score</h4>
				If you have an invalid score, you can delete it by going to that score and clicking
				"Delete Score".
			</Col>
			<Col className="mt-8" xs={12}>
				<h4>Undo Import</h4>
				If you messed up an import, you can undo it by going to{" "}
				<Link to={`/u/${reqUser.username}/imports`}>your imports page</Link> and click
				"Revert Import".
			</Col>
			<Col className="mt-8" xs={12}>
				<h3>Completely Wipe Profile</h3>
				If you've <i>really</i> messed up, you can wipe your entire profile for{" "}
				{FormatGame(game)}.
				<br />
				<Alert className="mt-4" style={{ fontSize: "1.5rem" }} variant="warning">
					It is very important to know that this is <b>NOT REVERSIBLE.</b> Wiping your
					profile will <b>COMPLETELY DELETE</b> all of your {FormatGame(game)} scores from
					our server. We will not be able to retrieve them.
				</Alert>
				<br />
				<Form.Group>
					<Form.Label>Confirm Password</Form.Label>
					<Form.Control
						autoComplete="off"
						onChange={(e) => setPassword(e.target.value)}
						type="password"
						value={password}
					/>
				</Form.Group>
				<Button
					className="text-wrap w-100 mt-4"
					disabled={deleting}
					onClick={async () => {
						if (
							confirm(
								`You are really about to delete all of your ${FormatGame(game)} scores. This is your last chance to turn back.`,
							)
						) {
							setDeleting(true);

							const res = await APIFetchV1(
								`/users/${reqUser.id}/games/${game}`,
								{
									method: "DELETE",
									body: JSON.stringify({ "!password": password }),
									headers: {
										"Content-Type": "application/json",
									},
								},
								true,
								true,
							);

							setDeleting(false);

							if (res.success) {
								window.location.href = "/";
							}
						}
					}}
					variant="outline-danger"
				>
					Yes, I want to delete my {FormatGame(game)} account.
				</Button>
				{deleting && (
					<>
						<Divider />
						<Loading />
						<div className="mt-4 text-center">
							This operation can take up to 5 minutes. The UI may time out. Please be
							patient.
						</div>
					</>
				)}
			</Col>
		</Row>
	);
}
