import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import DiscordLink from "#components/util/DiscordLink";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import React, { useContext, useEffect, useState } from "react";
import { Alert } from "react-bootstrap";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { Link } from "react-router-dom";
import {
	type APIImportTypes,
	type FileUploadImportTypes,
	type GameGroup,
	GetGameGroupConfig,
	type ImportTypes,
	type integer,
	type UserDocument,
} from "tachi-common";

export default function ImportPage({ user }: { user: UserDocument }) {
	useSetSubheader(["Import Scores"]);

	const [game, setGame] = useState<GameGroup | null>(null);

	const queryGame = new URLSearchParams(window.location.search).get("game");

	useEffect(() => {
		if (queryGame) {
			setGame(queryGame as GameGroup);
		}
	}, [queryGame]);

	return (
		<>
			<div>
				<h4>
					Here, you can import score files, Synchronise with existing services, or set up
					in-game automatic score uploading!
				</h4>
				Don't see what you want here? Make a <a>Feature Request</a>, or ask around on the{" "}
				<DiscordLink>Discord</DiscordLink>.
				<br />
				Know how to program, and want to write a script yourself? Check out{" "}
				<ExternalLink href="https://docs.tachi.ac/codebase/batch-manual">
					Batch Manual
				</ExternalLink>
				.
				<br />
				Want to manage or revert an import? Go to{" "}
				<Link to={`/u/${user.username}/imports`}>Import Management</Link>.
				<br />
				Scores that could not be matched to a chart are kept as{" "}
				<Link to={`/u/${user.username}/orphans`}>orphans</Link> (view or delete them there).
			</div>
			<hr />
			<Form.Select
				onChange={(e) =>
					setGame(e.target.value === "" ? null : (e.target.value as GameGroup))
				}
				value={game ?? ""}
			>
				<option value="">Please select a game.</option>
				{TachiConfig.GAME_GROUPS.map((e) => (
					<option key={e} value={e}>
						{GetGameGroupConfig(e).name}
					</option>
				))}
			</Form.Select>
			<hr />

			{game ? <ImportInfoDisplayer game={game} /> : <ShowRecentImports />}
		</>
	);
}

function ShowRecentImports() {
	const { user } = useContext(UserContext);

	if (!user) {
		return <>You're not signed in.</>;
	}

	return <InnerShowRecentImports user={user} />;
}

function InnerShowRecentImports({ user }: { user: UserDocument }) {
	const { data, error } = useApiQuery<{ count: integer; importType: ImportTypes }[]>(
		`/users/${user.id}/recent-imports`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const filteredData = data.filter(
		(e) => e.importType.startsWith("file/") || e.importType.startsWith("api/"),
	);

	if (filteredData.length === 0) {
		return null;
	}

	return (
		<>
			<h4>Recently Used Import Methods</h4>
			<Divider />
			<Row>
				{filteredData.map((e) => (
					<ImportTypeInfoCard
						importType={e.importType as APIImportTypes | FileUploadImportTypes}
						key={e.importType}
					/>
				))}
			</Row>
		</>
	);
}

function ImportInfoDisplayer({ game }: { game: GameGroup }) {
	const gameConfig = GetGameGroupConfig(game);

	const Content = [<ImportTypeInfoCard importType="file/batch-manual" key="file/batch-manual" />];

	if (game === "iidx") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="fervidex"
				key="Fervidex"
				moreInfo="This works with both Infinitas and other clients and is the recommended way to import scores, as it provides quality data in real-time."
				name="Fervidex"
			/>,
			<ImportTypeInfoCard
				importType="file/eamusement-iidx-csv"
				key="file/eamusement-iidx-csv"
			/>,
			<ImportTypeInfoCard importType="api/flo-iidx" key="api/flo-iidx" />,
			<ImportTypeInfoCard importType="api/eag-iidx" key="api/eag-iidx" />,
			<ImportInfoCard
				desc="Use your data from a CG instance (Dev/GAN/NAG)."
				href="kt-cg-iidx-importer"
				key="IIDX CG Site Importer"
				moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
				name="IIDX CG Site Importer"
			/>,
			<ImportTypeInfoCard importType="file/solid-state-squad" key="file/solid-state-squad" />,
			<ImportTypeInfoCard importType="file/pli-iidx-csv" key="file/pli-iidx-csv" />,
		);
	} else if (game === "sdvx") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores and dans!"
				href="mikado"
				key="Mikado"
				moreInfo="This is the recommended way to import SDVX scores, data is submitted after passing the score/result screen."
				name="Mikado"
			/>,
			<ImportInfoCard
				desc="Automatically import scores from SDVX Konaste!"
				href="kshook"
				key="Konaste Hook"
				moreInfo="Yep, it's that simple."
				name="Konaste Hook"
			/>,
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="barbatos"
				key="Barbatos"
				moreInfo={
					<>
						High quality data in real-time. <br />
						Note: Only for versions up to 2022081600.
					</>
				}
				name="Barbatos"
			/>,
			<ImportTypeInfoCard
				importType="file/eamusement-sdvx-csv"
				key="file/eamusement-sdvx-csv"
			/>,
			<ImportTypeInfoCard importType="api/flo-sdvx" key="api/flo-sdvx" />,
			<ImportTypeInfoCard importType="api/eag-sdvx" key="api/eag-sdvx" />,
			<ImportTypeInfoCard importType="api/cg-dev-sdvx" key="api/cg-dev-sdvx" />,
			<ImportTypeInfoCard importType="api/cg-gan-sdvx" key="api/cg-gan-sdvx" />,
			<ImportTypeInfoCard importType="api/cg-nag-sdvx" key="api/cg-nag-sdvx" />,
			<ImportTypeInfoCard importType="api/min-sdvx" key="api/min-sdvx" />,
		);
	} else if (game === "chunithm") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores and dans!"
				href="saekawa"
				key="Saekawa"
				moreInfo="This is the recommended way to import CHUNITHM scores, data is submitted at the end of every credit."
				name="Saekawa"
			/>,
			<ImportInfoCard
				desc="Use your data from CHUNITHM NET."
				href="kt-chunithm-site-importer"
				key="CHUNITHM Site Importer"
				moreInfo="If you are playing on an official CHUNITHM server, you can import play data from it here."
				name="CHUNITHM Site Importer"
			/>,
			<ImportInfoCard
				desc="Export your scores from an Aqua/ARTEMiS instance."
				href="aqua-artemis-exporter"
				key="Aqua/ARTEMiS Exporter"
				moreInfo={
					<>
						This is a script that exports scores from an Aqua/ARTEMiS instance. <br />
						Note: You will need direct access to the server instance.
					</>
				}
				name="Aqua/ARTEMiS Exporter"
			/>,
			<ImportTypeInfoCard importType="api/myt-chunithm" key="api/myt-chunithm" />,
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="chunitachi"
				key="Chunitachi"
				moreInfo={
					<>
						This is the recommended way to import CHUNITHM scores, as it provides high
						quality data in real-time. <br />
						Note: Only for versions PARADISE and PARADISE LOST.
					</>
				}
				name="Chunitachi"
			/>,
		);
	} else if (game === "bms") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="lr2oraja-ir"
				key="LR2oraja IR"
				moreInfo="This is the recommended way to import BMS scores, as it provides high quality data in real-time."
				name="LR2oraja IR"
			/>,
			<ImportInfoCard
				desc="Automatically import scores from LR2."
				href="lr2hook"
				key="LR2 IR"
				moreInfo="IMPORTANT: Bokutachi **DOES NOT** provide official support for LR2. Unless you have a *really* good reason, please use lr2oraja instead."
				name="LR2 Hook"
			/>,
			<ImportInfoCard
				desc="Import scores from a LR2oraja score database file."
				href="lr2oraja-db"
				key="LR2oraja Database Import"
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				name="LR2oraja Database Import"
			/>,
			<ImportInfoCard
				desc="Import scores from a LR2 score database file."
				href="lr2-db"
				key="LR2 Database Import"
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				name="LR2 Database Import"
			/>,
		);
	} else if (game === "usc") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="usc-ir"
				key="USC IR"
				moreInfo="This is the recommended way to import USC scores, as it provides high quality data in real-time."
				name="USC IR"
			/>,
			<ImportInfoCard
				desc="Import scores from a USC score database file."
				href="usc-db"
				key="USC Database Import"
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				name="USC Database Import"
			/>,
		);
	} else if (game === "popn") {
		Content.unshift(
			<ImportInfoCard
				desc={`Automatically upload Pop'n scores to ${TachiConfig.NAME}!`}
				href="silent-hook"
				key="Silent Hook"
				moreInfo="Yep, it's that simple."
				name="Silent Hook"
			/>,
			<ImportTypeInfoCard importType="api/cg-dev-popn" key="api/cg-dev-popn" />,
			<ImportTypeInfoCard importType="api/cg-gan-popn" key="api/cg-gan-popn" />,
			<ImportTypeInfoCard importType="api/cg-nag-popn" key="api/cg-nag-popn" />,
		);
	} else if (game === "pms") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them!"
				href="beatoraja-ir-pms"
				key="Beatoraja IR"
				moreInfo="This is the recommended way to import PMS scores, as it provides high quality data in real-time."
				name="Beatoraja IR"
			/>,
		);
	} else if (game === "wacca") {
		Content.unshift(
			<ImportTypeInfoCard importType="api/myt-wacca" key="api/myt-wacca" />,
			<ImportInfoCard
				desc="Use your data from WaccaMyPageScraper."
				href="wacca-mypage-scraper"
				key="WACCA MyPage Scraper"
				moreInfo="If you saved your play data from MyPage using XezolesS's WaccaMyPageScraper project, you can import it here."
				name="WaccaMyPageScraper"
			/>,
		);
	} else if (game === "maimaidx") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them."
				href="rizu"
				key="Rizu"
				moreInfo="This is the recommended way to import maimai DX scores; data is submitted at the end of each play."
				name="Rizu"
			/>,
			<ImportInfoCard
				desc="Use your data from maimai DX NET."
				href="kt-maimaidx-site-importer"
				key="maimai DX NET Importer"
				moreInfo="If you are playing on an official maimai DX server, you can import play data from it here."
				name="maimai DX Site Importer"
			/>,
			<ImportTypeInfoCard importType="api/myt-maimaidx" key="api/myt-maimaidx" />,
		);
	} else if (game === "museca") {
		Content.unshift(
			<ImportTypeInfoCard importType="api/cg-dev-museca" key="api/cg-dev-museca" />,
			<ImportTypeInfoCard importType="api/cg-gan-museca" key="api/cg-gan-museca" />,
			<ImportTypeInfoCard importType="api/cg-nag-museca" key="api/cg-nag-museca" />,
		);
	} else if (game === "itg") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them (in ITGMania)!"
				href="itghook"
				key="SL-ITG"
				name="Simply Love ITGMania Module"
			/>,
		);
	} else if (game === "ongeki") {
		Content.unshift(
			<ImportInfoCard
				desc="Automatically import scores, whenever you get them."
				href="inohara"
				key="Inohara"
				moreInfo="This is the recommended way to import O.N.G.E.K.I. scores; data is submitted at the end of each play."
				name="Inohara"
			/>,
			<ImportInfoCard
				desc="Use your data from O.N.G.E.K.I. NET."
				href="kt-ongeki-site-importer"
				key="O.N.G.E.K.I. NET Importer"
				moreInfo="If you are playing on an official Ongeki server, you can import play data from it here."
				name="O.N.G.E.K.I. Site Importer"
			/>,
			<ImportInfoCard
				desc="Export your scores from an ARTEMiS instance."
				href="ongeki-artemis-exporter"
				key="ARTEMiS Exporter"
				moreInfo={
					<>
						This is a script that exports scores from an ARTEMiS instance. <br />
						Note: You will need direct access to the server instance.
					</>
				}
				name="ARTEMiS Exporter"
			/>,
			<ImportTypeInfoCard importType="api/myt-ongeki" key="api/myt-ongeki" />,
		);
	} else if (game === "jubeat") {
		Content.unshift(
			<ImportTypeInfoCard importType="api/cg-dev-jubeat" key="api/cg-dev-jubeat" />,
			<ImportTypeInfoCard importType="api/cg-gan-jubeat" key="api/cg-gan-jubeat" />,
			<ImportTypeInfoCard importType="api/cg-nag-jubeat" key="api/cg-nag-jubeat" />,
		);
	} else if (game === "arcaea") {
		Content.unshift(
			<ImportInfoCard
				desc="Import PBs from your local savefile."
				href="arcaea-st3"
				key="Arcaea ST3"
				moreInfo="This method is intended for syncing up old scores offline. "
				name="ST3 Import"
			/>,
		);
	}

	return (
		<>
			<div className="text-center mb-4">
				<h1>{gameConfig.name}</h1>
			</div>
			<Row xs={{ cols: 1 }}>
				<Col xs={12}>
					<InputAlert game={game} />
				</Col>
			</Row>
			<Row lg={{ cols: 2 }} xs={{ cols: 1 }}>
				{Content}
			</Row>
		</>
	);
}

function InputAlert({ game }: { game: GameGroup }) {
	function doit(game: GameGroup): JSX.Element | null {
		switch (game) {
			case "jubeat":
			case "maimai":
			case "iidx":
			case "museca":
			case "chunithm":
			case "gitadora":
			case "maimaidx":
			case "popn":
			case "wacca":
			case "ongeki":
			case "ddr":
				return (
					<>
						<strong>Scores must be achieved on an arcade-size controller!</strong>
						<br />
						Playing on other input devices (like a keyboard) will get you in trouble.
					</>
				);
			case "sdvx":
				return (
					<>
						<strong>Scores must be achieved on an arcade-size controller!</strong>
						<br />
						Playing on other input devices (like a keyboard) will get you in trouble.
						<br />
						<strong>
							A Pocket-Voltex DOES NOT count as an <i>ARCADE SIZE</i> controller!
						</strong>
					</>
				);

			case "usc":
				return (
					<>
						<strong>Please use the right leaderboard for your controller!</strong>
						<br />
						<br />
						<strong>Arcade-sized controllers</strong> should go on the controller
						leaderboards.
						<br />
						<strong>Keyboards and anything else</strong> go on the Keyboard/Other
						leaderboards.
						<br />
						<br />
						<strong>
							A Pocket-Voltex DOES NOT count as an <i>ARCADE SIZE</i> controller!
						</strong>
					</>
				);

			case "itg":
			case "arcaea":
			case "bms":
			case "pms":
				return null;
		}
	}

	const ct = doit(game);

	if (!ct) {
		return <></>;
	}

	return (
		<Alert variant="warning">
			<div className="d-flex" style={{ alignItems: "center", gap: "1rem", fontSize: "2rem" }}>
				<div style={{ fontSize: "4rem" }}>
					<Icon type="exclamation-triangle" />
				</div>
				<div className="text-body">{ct}</div>
			</div>
		</Alert>
	);
}

function ImportTypeInfoCard({
	importType,
}: {
	importType: APIImportTypes | FileUploadImportTypes;
}): JSX.Element | null {
	if (!TachiConfig.IMPORT_TYPES.includes(importType)) {
		return null;
	}

	switch (importType) {
		case "api/eag-iidx":
			return (
				<ImportInfoCard
					desc="Pull your IIDX scores from the EAG Network."
					href="iidx-eag"
					key="iidx-eag"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="EAG Integration"
				/>
			);
		case "api/flo-iidx":
			return (
				<ImportInfoCard
					desc="Pull your IIDX scores from the FLO Network."
					href="iidx-flo"
					key="iidx-flo"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="FLO Integration"
				/>
			);
		case "api/flo-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the FLO Network."
					href="sdvx-flo"
					key="sdvx-flo"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="FLO Integration"
				/>
			);
		case "api/eag-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the EAG Network."
					href="sdvx-eag"
					key="sdvx-eag"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="EAG Integration"
				/>
			);
		case "api/min-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the MIN Network."
					href="sdvx-min"
					key="sdvx-min"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="MIN Integration"
				/>
			);
		case "api/cg-dev-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the CG Dev Network."
					href="cg-dev-sdvx"
					key="cg-dev-sdvx"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG Dev Integration"
				/>
			);
		case "api/cg-nag-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the NAG Network."
					href="cg-nag-sdvx"
					key="cg-nag-sdvx"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG NAG Integration"
				/>
			);
		case "api/cg-gan-sdvx":
			return (
				<ImportInfoCard
					desc="Pull your SDVX scores from the GAN Network."
					href="cg-gan-sdvx"
					key="cg-gan-sdvx"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG GAN Integration"
				/>
			);
		case "api/cg-dev-popn":
			return (
				<ImportInfoCard
					desc="Pull your pop'n music scores from the CG Dev Network."
					href="cg-dev-popn"
					key="cg-dev-popn"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG Dev Integration"
				/>
			);
		case "api/cg-nag-popn":
			return (
				<ImportInfoCard
					desc="Pull your pop'n music scores from the NAG Network."
					href="cg-nag-popn"
					key="cg-nag-popn"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG NAG Integration"
				/>
			);
		case "api/cg-gan-popn":
			return (
				<ImportInfoCard
					desc="Pull your pop'n music scores from the GAN Network."
					href="cg-gan-popn"
					key="cg-gan-popn"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG GAN Integration"
				/>
			);
		case "api/cg-dev-museca":
			return (
				<ImportInfoCard
					desc="Pull your MUSECA scores from the CG Dev Network."
					href="cg-dev-museca"
					key="cg-dev-museca"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG Dev Integration"
				/>
			);
		case "api/cg-gan-museca":
			return (
				<ImportInfoCard
					desc="Pull your MUSECA scores from the GAN Network."
					href="cg-gan-museca"
					key="cg-gan-museca"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG GAN Integration"
				/>
			);
		case "api/cg-nag-museca":
			return (
				<ImportInfoCard
					desc="Pull your MUSECA scores from the NAG Network."
					href="cg-nag-museca"
					key="cg-nag-museca"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG NAG Integration"
				/>
			);
		case "api/cg-dev-jubeat":
			return (
				<ImportInfoCard
					desc="Pull your Jubeat scores from the CG Dev Network."
					href="cg-dev-jubeat"
					key="cg-dev-jubeat"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG Dev Integration"
				/>
			);
		case "api/cg-nag-jubeat":
			return (
				<ImportInfoCard
					desc="Pull your Jubeat scores from the NAG Network."
					href="cg-nag-jubeat"
					key="cg-nag-jubeat"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG NAG Integration"
				/>
			);
		case "api/cg-gan-jubeat":
			return (
				<ImportInfoCard
					desc="Pull your Jubeat scores from the GAN Network."
					href="cg-gan-jubeat"
					key="cg-gan-jubeat"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="CG GAN Integration"
				/>
			);
		case "api/myt-chunithm":
			return (
				<ImportInfoCard
					desc="Pull your Chunithm scores from the MYT Network."
					href="myt-chunithm"
					key="myt-chunithm"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="MYT Integration"
				/>
			);
		case "api/myt-maimaidx":
			return (
				<ImportInfoCard
					desc="Pull your MaiMai DX scores from the MYT Network."
					href="myt-maimaidx"
					key="myt-maimaidx"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="MYT Integration"
				/>
			);
		case "api/myt-ongeki":
			return (
				<ImportInfoCard
					desc="Pull your Ongeki scores from the MYT Network."
					href="myt-ongeki"
					key="myt-ongeki"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="MYT Integration"
				/>
			);
		case "api/myt-wacca":
			return (
				<ImportInfoCard
					desc="Pull your WACCA scores from the MYT Network."
					href="myt-wacca"
					key="myt-wacca"
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					name="MYT Integration"
				/>
			);
		case "file/eamusement-iidx-csv":
			return (
				<ImportInfoCard
					desc="Use the official E-Amusement CSV to import scores."
					href="iidx-eam-csv"
					key="E-Amusement CSV"
					moreInfo="Note: This format has issues with timestamps, since it stores only one timestamp per song. Playing the same song on different difficulties in a session will result in broken timestamps on your account."
					name="E-Amusement CSV"
				/>
			);
		case "file/solid-state-squad":
			return (
				<ImportInfoCard
					desc="Use a SOLID STATE SQUAD XML file to import scores."
					href="sss-xml"
					key="SOLID STATE SQUAD .xml"
					moreInfo={
						<>
							This service is rather old, and was originally for manually tracking CS
							scores. However, it still exports data, and we still support it! <br />
							<br />
							Also, these guys provide pretty good quality data, especially for the
							time.
						</>
					}
					name="SOLID STATE SQUAD .xml"
				/>
			);
		case "file/eamusement-sdvx-csv":
			return (
				<ImportInfoCard
					desc="Use the official E-Amusement CSV to import scores."
					href="sdvx-eam-csv"
					key="SDVX E-Amusement CSV"
					moreInfo="Note: This format doesn't support timestamps, which means sessions cannot be generated from it."
					name="E-Amusement CSV"
				/>
			);
		case "file/batch-manual":
			return (
				<ImportInfoCard
					desc={`A JSON format ${TachiConfig.NAME} recognises and can import scores from.`}
					href="batch-manual"
					key="Batch Manual"
					moreInfo={
						<>
							This is for programmers to create their own import scripts. <br /> Check
							the{" "}
							<ExternalLink href="https://docs.tachi.ac/codebase/batch-manual">
								documentation
							</ExternalLink>
							.
						</>
					}
					name="Batch Manual"
				/>
			);
		case "file/pli-iidx-csv":
			return (
				<ImportInfoCard
					desc="Use a PLI .csv file to import scores."
					href="iidx-pli-csv"
					key="PLI .csv"
					moreInfo="Note: This network is currently not being developed on. I highly recommend switching to anything else. I highly recommend using Fervidex instead, and just using this once to sync things up."
					name="PLI .csv"
				/>
			);
		case "file/mypagescraper-records-csv":
		case "file/mypagescraper-player-csv":
			// We only expect people to use these import types once ever, so don't recommend them.
			return <></>;
		default:
			// For some reason, the webpack tschecker thinks
			// that the above switch isn't exhaustive. However, it is.
			return (
				<>
					Err: Unknown importType <code>{importType}</code>
				</>
			);
	}
}

function ImportInfoCard({
	name,
	href,
	desc,
	moreInfo,
}: {
	desc: string;
	href: string;
	moreInfo?: React.ReactChild;
	name: string;
}) {
	return (
		<Col className="p-2 flex-grow-1">
			<Card
				className="h-100"
				footer={
					<LinkButton className="float-end" to={`/import/${href}`}>
						Use this!
					</LinkButton>
				}
				header={name}
			>
				<div style={{ fontSize: "1.5rem" }}>{desc}</div>
				{moreInfo && (
					<>
						<Divider />
						<div>{moreInfo}</div>
					</>
				)}
			</Card>
		</Col>
	);
}
