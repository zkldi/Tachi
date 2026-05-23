import { ErrorPage } from "#app/pages/ErrorPage";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import useImport from "#components/util/import/useImport";
import Loading from "#components/util/Loading";
import useApiQuery from "#components/util/query/useApiQuery";
import { UserContext } from "#context/UserContext";
import React, { useContext, useEffect, useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { type APIImportTypes, GetGameGroupConfig } from "tachi-common";

import ImportStateRenderer from "./ImportStateRenderer";

interface Props {
	hash: string;
	kaiType: "EAG" | "FLO" | "MIN";
	clientID: string;
	redirectUri: string;
	game: "iidx" | "sdvx";
}

export default function KAIIntegrationPage({ clientID, hash, kaiType, redirectUri, game }: Props) {
	const gameConfig = GetGameGroupConfig(game);

	useSetSubheader(["Import Scores", `${gameConfig.name} Sync (${kaiType})`]);

	if (!clientID) {
		return (
			<div>
				Sorry, this service isn't supported here.
				{import.meta.env.VITE_IS_LOCAL_DEV &&
					` You haven't set VITE_${kaiType}_CLIENT_ID in your .env file.`}
			</div>
		);
	}

	// i have no idea how to make this pattern not insufferable, sorry

	// eslint-disable-next-line react-hooks/rules-of-hooks
	const { user } = useContext(UserContext);

	if (!user) {
		return <ErrorPage statusCode={401} />;
	}

	// eslint-disable-next-line react-hooks/rules-of-hooks
	const { data, error } = useApiQuery<{ authStatus: boolean }>(
		`/users/${user.id}/integrations/kai/${kaiType}`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	if (data.authStatus) {
		return <KAIImporter game={game} kaiType={kaiType} />;
	} else {
		return <KAINeedsIntegrate {...{ kaiType, hash, clientID, redirectUri }} />;
	}
}

function KAIImporter({ kaiType, game }: Pick<Props, "game" | "kaiType">) {
	let importType: APIImportTypes;

	if (kaiType === "MIN") {
		importType = "api/min-sdvx";
	} else if (kaiType === "FLO") {
		importType = game === "iidx" ? "api/flo-iidx" : "api/flo-sdvx";
	} else {
		importType = game === "iidx" ? "api/eag-iidx" : "api/eag-sdvx";
	}

	const { importState, runImport, resetImport } = useImport("/import/from-api", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			importType,
		}),
	});

	return (
		<div>
			<h2 className="text-center mb-4">Authenticated with {kaiType}.</h2>
			<Divider />
			<div className="d-flex w-100 justify-content-center">
				<Button
					className="mx-auto"
					disabled={
						importState.state === "waiting_init" ||
						importState.state === "waiting_processing"
					}
					onClick={() => runImport()}
					variant="primary"
				>
					{importState.state === "waiting_init" ||
					importState.state === "waiting_processing"
						? "Syncing..."
						: "Click to Sync!"}
				</Button>
			</div>
			<Divider />
			<div>
				Play on {kaiType} a lot? You can synchronise your scores straight from the discord
				by typing <code>/sync</code>!
			</div>
			<Divider />
			<ImportStateRenderer onReverted={resetImport} state={importState} />
		</div>
	);
}

function KAINeedsIntegrate({ kaiType, hash, clientID, redirectUri }: Omit<Props, "game">) {
	const urlParams = new URLSearchParams({
		client_id: clientID,
		response_type: "code",
		redirectUri,
		scope: "settings_read",
	});

	const [url, setUrl] = useState<string>("");
	const [valid, setValid] = useState<boolean | null>(null);

	useEffect(() => {
		if (!url) {
			setValid(null);
			return;
		}

		const data = new TextEncoder().encode(url);

		crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
			const hashHex = Array.from(new Uint8Array(hashBuffer))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");

			setValid(hashHex === hash);
		});
	}, [url]);

	return (
		<div>
			<h4 className="text-center mb-4">You need to authenticate with {kaiType}!</h4>
			<Form.Group>
				<Form.Text>
					For security reasons, please input the URL of the site for {kaiType}.
				</Form.Text>
				<InputGroup>
					<InputGroup.Text>https://</InputGroup.Text>
					<Form.Control onChange={(e) => setUrl(e.target.value)} value={url} />
				</InputGroup>
			</Form.Group>

			{url.split(".").length >= 3 && (
				<>
					<br />
					<span className="text-danger">
						The URL should only have one <code>.</code> in it.
					</span>
				</>
			)}
			{url.includes("/") && (
				<>
					<br />
					<span className="text-danger">
						The URL should not need any <code>/</code> characters!
					</span>
				</>
			)}
			<Divider />
			<div>You'll need to come back to this page after linking!</div>
			<Divider />
			{valid === null ? null : valid ? (
				<ExternalLink
					className="btn btn-primary"
					href={`https://kailua.${url}/oauth/authorize?${urlParams.toString()}`}
				>
					Link with {kaiType}!
				</ExternalLink>
			) : (
				"Your input doesn't match up with the URL in our records."
			)}
		</div>
	);
}
