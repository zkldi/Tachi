import useSetSubheader from "components/layout/header/useSetSubheader";
import Card from "components/layout/page/Card";
import ApiError from "components/util/ApiError";
import DiscordLink from "components/util/DiscordLink";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import LinkButton from "components/util/LinkButton";
import Loading from "components/util/Loading";
import useApiQuery from "components/util/query/useApiQuery";
import { UserContext } from "context/UserContext";
import { TachiConfig } from "lib/config";
import React, { useContext, useEffect, useState } from "react";
import Row from "react-bootstrap/Row";
import Form from "react-bootstrap/Form";
import { Link } from "react-router-dom";
import {
	APIImportTypes,
	FileUploadImportTypes,
	Game,
	GetGameConfig,
	ImportTypes,
	integer,
	UserDocument,
} from "tachi-common";
import Col from "react-bootstrap/Col";
import { Alert } from "react-bootstrap";
import Icon from "components/util/Icon";

export default function ImportPage({ user }: { user: UserDocument }) {
	useSetSubheader(["Import Scores"]);

	const [game, setGame] = useState<Game | null>(null);

	const queryGame = new URLSearchParams(window.location.search).get("game");

	useEffect(() => {
		if (queryGame) {
			setGame(queryGame as Game);
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
			</div>
			<hr />
			<Form.Select
				onChange={(e) => setGame(e.target.value === "" ? null : (e.target.value as Game))}
				value={game ?? ""}
			>
				<option value="">Please select a game.</option>
				{TachiConfig.GAMES.map((e) => (
					<option value={e} key={e}>
						{GetGameConfig(e).name}
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
	const { data, error } = useApiQuery<{ importType: ImportTypes; count: integer }[]>(
		`/users/${user.id}/recent-imports`
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const filteredData = data.filter(
		(e) => e.importType.startsWith("file/") || e.importType.startsWith("api/")
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
						key={e.importType}
						importType={e.importType as FileUploadImportTypes | APIImportTypes}
					/>
				))}
			</Row>
		</>
	);
}

function ImportInfoDisplayer({ game }: { game: Game }) {
	const gameConfig = GetGameConfig(game);

	const Content = [<ImportTypeInfoCard key="file/batch-manual" importType="file/batch-manual" />];

	if (game === "iidx") {
		Content.unshift(
			<ImportInfoCard
				name="Fervidex"
				href="fervidex"
				desc="Automatically import scores, whenever you get them!"
				moreInfo="This works with both Infinitas and other clients and is the recommended way to import scores, as it provides quality data in real-time."
				key="Fervidex"
			/>,
			<ImportTypeInfoCard
				key="file/eamusement-iidx-csv"
				importType="file/eamusement-iidx-csv"
			/>,
			<ImportTypeInfoCard key="api/flo-iidx" importType="api/flo-iidx" />,
			<ImportTypeInfoCard key="api/eag-iidx" importType="api/eag-iidx" />,
			<ImportInfoCard
				name="IIDX CG Site Importer"
				href="kt-cg-iidx-importer"
				desc="Use your data from a CG instance (Dev/GAN/NAG)."
				moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
				key="IIDX CG Site Importer"
			/>,
			<ImportTypeInfoCard key="file/solid-state-squad" importType="file/solid-state-squad" />,
			<ImportTypeInfoCard key="file/pli-iidx-csv" importType="file/pli-iidx-csv" />
		);
	} else if (game === "sdvx") {
		Content.unshift(
			<ImportInfoCard
				name="Mikado"
				href="mikado"
				desc="Automatically import scores and dans!"
				moreInfo="This is the recommended way to import SDVX scores, data is submitted after passing the score/result screen."
				key="Mikado"
			/>,
			<ImportInfoCard
				name="Konaste Hook"
				href="kshook"
				desc="Automatically import scores from SDVX Konaste!"
				moreInfo="Yep, it's that simple."
				key="Konaste Hook"
			/>,
			<ImportInfoCard
				name="Barbatos"
				href="barbatos"
				desc="Automatically import scores, whenever you get them!"
				moreInfo={
					<>
						High quality data in real-time. <br />
						Note: Only for versions up to 2022081600.
					</>
				}
				key="Barbatos"
			/>,
			<ImportTypeInfoCard
				key="file/eamusement-sdvx-csv"
				importType="file/eamusement-sdvx-csv"
			/>,
			<ImportTypeInfoCard key="api/flo-sdvx" importType="api/flo-sdvx" />,
			<ImportTypeInfoCard key="api/eag-sdvx" importType="api/eag-sdvx" />,
			<ImportTypeInfoCard key="api/cg-dev-sdvx" importType="api/cg-dev-sdvx" />,
			<ImportTypeInfoCard key="api/cg-gan-sdvx" importType="api/cg-gan-sdvx" />,
			<ImportTypeInfoCard key="api/cg-nag-sdvx" importType="api/cg-nag-sdvx" />,
			<ImportTypeInfoCard key="api/min-sdvx" importType="api/min-sdvx" />
		);
	} else if (game === "chunithm") {
		Content.unshift(
			<ImportInfoCard
				name="Saekawa"
				href="saekawa"
				desc="Automatically import scores and dans!"
				moreInfo="This is the recommended way to import CHUNITHM scores, data is submitted at the end of every credit."
				key="Saekawa"
			/>,
			<ImportInfoCard
				name="CHUNITHM Site Importer"
				href="kt-chunithm-site-importer"
				desc="Use your data from CHUNITHM NET."
				moreInfo="If you are playing on an official CHUNITHM server, you can import play data from it here."
				key="CHUNITHM Site Importer"
			/>,
			<ImportInfoCard
				name="Aqua/ARTEMiS Exporter"
				href="aqua-artemis-exporter"
				desc="Export your scores from an Aqua/ARTEMiS instance."
				moreInfo={
					<>
						This is a script that exports scores from an Aqua/ARTEMiS instance. <br />
						Note: You will need direct access to the server instance.
					</>
				}
				key="Aqua/ARTEMiS Exporter"
			/>,
			<ImportTypeInfoCard key="api/myt-chunithm" importType="api/myt-chunithm" />,
			<ImportInfoCard
				name="Chunitachi"
				href="chunitachi"
				desc="Automatically import scores, whenever you get them!"
				moreInfo={
					<>
						This is the recommended way to import CHUNITHM scores, as it provides high
						quality data in real-time. <br />
						Note: Only for versions PARADISE and PARADISE LOST.
					</>
				}
				key="Chunitachi"
			/>
		);
	} else if (game === "bms") {
		Content.unshift(
			<ImportInfoCard
				name="LR2oraja IR"
				href="lr2oraja-ir"
				desc="Automatically import scores, whenever you get them!"
				moreInfo="This is the recommended way to import BMS scores, as it provides high quality data in real-time."
				key="LR2oraja IR"
			/>,
			<ImportInfoCard
				name="LR2 Hook"
				href="lr2hook"
				desc="Automatically import scores from LR2."
				moreInfo="IMPORTANT: Bokutachi **DOES NOT** provide official support for LR2. Unless you have a *really* good reason, please use lr2oraja instead."
				key="LR2 IR"
			/>,
			<ImportInfoCard
				name="LR2oraja Database Import"
				href="lr2oraja-db"
				desc="Import scores from a LR2oraja score database file."
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				key="LR2oraja Database Import"
			/>,
			<ImportInfoCard
				name="LR2 Database Import"
				href="lr2-db"
				desc="Import scores from a LR2 score database file."
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				key="LR2 Database Import"
			/>
		);
	} else if (game === "usc") {
		Content.unshift(
			<ImportInfoCard
				name="USC IR"
				href="usc-ir"
				desc="Automatically import scores, whenever you get them!"
				moreInfo="This is the recommended way to import USC scores, as it provides high quality data in real-time."
				key="USC IR"
			/>,
			<ImportInfoCard
				name="USC Database Import"
				href="usc-db"
				desc="Import scores from a USC score database file."
				moreInfo="This should be done once initially to sync scores up, but not all the time, as it provides worse quality data."
				key="USC Database Import"
			/>
		);
	} else if (game === "popn") {
		Content.unshift(
			<ImportInfoCard
				name="Silent Hook"
				href="silent-hook"
				desc={`Automatically upload Pop'n scores to ${TachiConfig.NAME}!`}
				moreInfo="Yep, it's that simple."
				key="Silent Hook"
			/>,
			<ImportTypeInfoCard key="api/cg-dev-popn" importType="api/cg-dev-popn" />,
			<ImportTypeInfoCard key="api/cg-gan-popn" importType="api/cg-gan-popn" />,
			<ImportTypeInfoCard key="api/cg-nag-popn" importType="api/cg-nag-popn" />
		);
	} else if (game === "pms") {
		Content.unshift(
			<ImportInfoCard
				name="Beatoraja IR"
				href="beatoraja-ir-pms"
				desc="Automatically import scores, whenever you get them!"
				moreInfo="This is the recommended way to import PMS scores, as it provides high quality data in real-time."
				key="Beatoraja IR"
			/>
		);
	} else if (game === "wacca") {
		Content.unshift(
			<ImportTypeInfoCard key="api/myt-wacca" importType="api/myt-wacca" />,
			<ImportInfoCard
				name="WaccaMyPageScraper"
				href="wacca-mypage-scraper"
				desc="Use your data from WaccaMyPageScraper."
				moreInfo="If you saved your play data from MyPage using XezolesS's WaccaMyPageScraper project, you can import it here."
				key="WACCA MyPage Scraper"
			/>
		);
	} else if (game === "maimaidx") {
		Content.unshift(
			<ImportInfoCard
				name="maimai DX Site Importer"
				href="kt-maimaidx-site-importer"
				desc="Use your data from maimai DX NET."
				moreInfo="If you are playing on an official maimai DX server, you can import play data from it here."
				key="maimai DX NET Importer"
			/>,
			<ImportTypeInfoCard key="api/myt-maimaidx" importType="api/myt-maimaidx" />
		);
	} else if (game === "museca") {
		Content.unshift(
			<ImportTypeInfoCard key="api/cg-dev-museca" importType="api/cg-dev-museca" />,
			<ImportTypeInfoCard key="api/cg-gan-museca" importType="api/cg-gan-museca" />,
			<ImportTypeInfoCard key="api/cg-nag-museca" importType="api/cg-nag-museca" />
		);
	} else if (game === "itg") {
		Content.unshift(
			<ImportInfoCard
				name="Simply Love ITGMania Module"
				href="itghook"
				desc="Automatically import scores, whenever you get them (in ITGMania)!"
				key="SL-ITG"
			/>
		);
	} else if (game === "ongeki") {
		Content.unshift(
			<ImportInfoCard
				name="Inohara"
				href="inohara"
				desc="Automatically import scores, whenever you get them."
				key="Inohara"
				moreInfo="This is the recommended way to import O.N.G.E.K.I. scores; data is submitted at the end of each play."
			/>,
			<ImportInfoCard
				name="ARTEMiS Exporter"
				href="ongeki-artemis-exporter"
				desc="Export your scores from an ARTEMiS instance."
				moreInfo={
					<>
						This is a script that exports scores from an ARTEMiS instance. <br />
						Note: You will need direct access to the server instance.
					</>
				}
				key="ARTEMiS Exporter"
			/>,
			<ImportTypeInfoCard key="api/myt-ongeki" importType="api/myt-ongeki" />
		);
	} else if (game === "jubeat") {
		Content.unshift(
			<ImportTypeInfoCard key="api/cg-dev-jubeat" importType="api/cg-dev-jubeat" />,
			<ImportTypeInfoCard key="api/cg-gan-jubeat" importType="api/cg-gan-jubeat" />,
			<ImportTypeInfoCard key="api/cg-nag-jubeat" importType="api/cg-nag-jubeat" />
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
			<Row xs={{ cols: 1 }} lg={{ cols: 2 }}>
				{Content}
			</Row>
		</>
	);
}

function InputAlert({ game }: { game: Game }) {
	function doit(game: Game): JSX.Element | null {
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
	importType: FileUploadImportTypes | APIImportTypes;
}): JSX.Element | null {
	if (!TachiConfig.IMPORT_TYPES.includes(importType)) {
		return null;
	}

	switch (importType) {
		case "api/eag-iidx":
			return (
				<ImportInfoCard
					name="EAG Integration"
					href="iidx-eag"
					desc="Pull your IIDX scores from the EAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="iidx-eag"
				/>
			);
		case "api/flo-iidx":
			return (
				<ImportInfoCard
					name="FLO Integration"
					href="iidx-flo"
					desc="Pull your IIDX scores from the FLO Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="iidx-flo"
				/>
			);
		case "api/flo-sdvx":
			return (
				<ImportInfoCard
					name="FLO Integration"
					href="sdvx-flo"
					desc="Pull your SDVX scores from the FLO Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="sdvx-flo"
				/>
			);
		case "api/eag-sdvx":
			return (
				<ImportInfoCard
					name="EAG Integration"
					href="sdvx-eag"
					desc="Pull your SDVX scores from the EAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="sdvx-eag"
				/>
			);
		case "api/min-sdvx":
			return (
				<ImportInfoCard
					name="MIN Integration"
					href="sdvx-min"
					desc="Pull your SDVX scores from the MIN Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="sdvx-min"
				/>
			);
		case "api/cg-dev-sdvx":
			return (
				<ImportInfoCard
					name="CG Dev Integration"
					href="cg-dev-sdvx"
					desc="Pull your SDVX scores from the CG Dev Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-dev-sdvx"
				/>
			);
		case "api/cg-nag-sdvx":
			return (
				<ImportInfoCard
					name="CG NAG Integration"
					href="cg-nag-sdvx"
					desc="Pull your SDVX scores from the NAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-nag-sdvx"
				/>
			);
		case "api/cg-gan-sdvx":
			return (
				<ImportInfoCard
					name="CG GAN Integration"
					href="cg-gan-sdvx"
					desc="Pull your SDVX scores from the GAN Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-gan-sdvx"
				/>
			);
		case "api/cg-dev-popn":
			return (
				<ImportInfoCard
					name="CG Dev Integration"
					href="cg-dev-popn"
					desc="Pull your pop'n music scores from the CG Dev Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-dev-popn"
				/>
			);
		case "api/cg-nag-popn":
			return (
				<ImportInfoCard
					name="CG NAG Integration"
					href="cg-nag-popn"
					desc="Pull your pop'n music scores from the NAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-nag-popn"
				/>
			);
		case "api/cg-gan-popn":
			return (
				<ImportInfoCard
					name="CG GAN Integration"
					href="cg-gan-popn"
					desc="Pull your pop'n music scores from the GAN Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-gan-popn"
				/>
			);
		case "api/cg-dev-museca":
			return (
				<ImportInfoCard
					name="CG Dev Integration"
					href="cg-dev-museca"
					desc="Pull your MUSECA scores from the CG Dev Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-dev-museca"
				/>
			);
		case "api/cg-gan-museca":
			return (
				<ImportInfoCard
					name="CG GAN Integration"
					href="cg-gan-museca"
					desc="Pull your MUSECA scores from the GAN Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-gan-museca"
				/>
			);
		case "api/cg-nag-museca":
			return (
				<ImportInfoCard
					name="CG NAG Integration"
					href="cg-nag-museca"
					desc="Pull your MUSECA scores from the NAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-nag-museca"
				/>
			);
		case "api/cg-dev-jubeat":
			return (
				<ImportInfoCard
					name="CG Dev Integration"
					href="cg-dev-jubeat"
					desc="Pull your Jubeat scores from the CG Dev Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-dev-jubeat"
				/>
			);
		case "api/cg-nag-jubeat":
			return (
				<ImportInfoCard
					name="CG NAG Integration"
					href="cg-nag-jubeat"
					desc="Pull your Jubeat scores from the NAG Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-nag-jubeat"
				/>
			);
		case "api/cg-gan-jubeat":
			return (
				<ImportInfoCard
					name="CG GAN Integration"
					href="cg-gan-jubeat"
					desc="Pull your Jubeat scores from the GAN Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="cg-gan-jubeat"
				/>
			);
		case "api/myt-chunithm":
			return (
				<ImportInfoCard
					name="MYT Integration"
					href="myt-chunithm"
					desc="Pull your Chunithm scores from the MYT Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="myt-chunithm"
				/>
			);
		case "api/myt-maimaidx":
			return (
				<ImportInfoCard
					name="MYT Integration"
					href="myt-maimaidx"
					desc="Pull your MaiMai DX scores from the MYT Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="myt-maimaidx"
				/>
			);
		case "api/myt-ongeki":
			return (
				<ImportInfoCard
					name="MYT Integration"
					href="myt-ongeki"
					desc="Pull your Ongeki scores from the MYT Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="myt-ongeki"
				/>
			);
		case "api/myt-wacca":
			return (
				<ImportInfoCard
					name="MYT Integration"
					href="myt-wacca"
					desc="Pull your WACCA scores from the MYT Network."
					moreInfo="Note: All networks are reduced to their first three letters for anonymity reasons."
					key="myt-wacca"
				/>
			);
		case "file/eamusement-iidx-csv":
			return (
				<ImportInfoCard
					name="E-Amusement CSV"
					href="iidx-eam-csv"
					desc="Use the official E-Amusement CSV to import scores."
					moreInfo="Note: This format has issues with timestamps, since it stores only one timestamp per song. Playing the same song on different difficulties in a session will result in broken timestamps on your account."
					key="E-Amusement CSV"
				/>
			);
		case "file/solid-state-squad":
			return (
				<ImportInfoCard
					name="SOLID STATE SQUAD .xml"
					href="sss-xml"
					desc="Use a SOLID STATE SQUAD XML file to import scores."
					moreInfo={
						<>
							This service is rather old, and was originally for manually tracking CS
							scores. However, it still exports data, and we still support it! <br />
							<br />
							Also, these guys provide pretty good quality data, especially for the
							time.
						</>
					}
					key="SOLID STATE SQUAD .xml"
				/>
			);
		case "file/eamusement-sdvx-csv":
			return (
				<ImportInfoCard
					name="E-Amusement CSV"
					href="sdvx-eam-csv"
					desc="Use the official E-Amusement CSV to import scores."
					moreInfo="Note: This format doesn't support timestamps, which means sessions cannot be generated from it."
					key="SDVX E-Amusement CSV"
				/>
			);
		case "file/batch-manual":
			return (
				<ImportInfoCard
					name="Batch Manual"
					href="batch-manual"
					desc={`A JSON format ${TachiConfig.NAME} recognises and can import scores from.`}
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
					key="Batch Manual"
				/>
			);
		case "file/pli-iidx-csv":
			return (
				<ImportInfoCard
					name="PLI .csv"
					href="iidx-pli-csv"
					desc="Use a PLI .csv file to import scores."
					moreInfo="Note: This network is currently not being developed on. I highly recommend switching to anything else. I highly recommend using Fervidex instead, and just using this once to sync things up."
					key="PLI .csv"
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
	name: string;
	href: string;
	desc: string;
	moreInfo?: React.ReactChild;
}) {
	return (
		<Col className="p-2 flex-grow-1">
			<Card
				className="h-100"
				header={name}
				footer={
					<LinkButton className="float-end" to={`/import/${href}`}>
						Use this!
					</LinkButton>
				}
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
