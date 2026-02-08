import { APIFetchV1 } from "util/api";
import { ErrorPage } from "app/pages/ErrorPage";
import useSetSubheader from "components/layout/header/useSetSubheader";
import ApiError from "components/util/ApiError";
import Divider from "components/util/Divider";
import FormInput from "components/util/FormInput";
import Loading from "components/util/Loading";
import useImport from "components/util/import/useImport";
import useApiQuery from "components/util/query/useApiQuery";
import { UserContext } from "context/UserContext";
import React, { useContext, useMemo, useReducer, useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { APIImportTypes, CGCardInfo, GetGameConfig } from "tachi-common";
import { SetState } from "types/react";
import Icon from "components/util/Icon";
import ImportStateRenderer from "./ImportStateRenderer";

interface Props {
	cgType: "dev" | "gan" | "nag";
	game: "sdvx" | "popn" | "museca" | "jubeat" | "iidx";
}

export default function CGIntegrationPage({ cgType, game }: Props) {
	const gameConfig = GetGameConfig(game);
	const cgName = cgType === "dev" ? "CG Dev" : `CG ${cgType.toUpperCase()}`;

	const [reload, shouldReloadCardInfo] = useReducer((x) => x + 1, 0);
	const [showEdit, setShowEdit] = useState(false);

	useSetSubheader(["Import Scores", `${gameConfig.name} Sync (${cgName})`]);

	const { user } = useContext(UserContext);

	if (!user) {
		return <ErrorPage statusCode={401} />;
	}

	const { data, error } = useApiQuery<CGCardInfo | null>(
		`/users/${user.id}/integrations/cg/${cgType}`,
		undefined,
		[reload]
	);

	if (error) {
		return <ApiError error={error} />;
	}

	// null is a valid response for this call, so be explicit with going to loading
	if (data === undefined) {
		return <Loading />;
	}

	return (
		<>
			{(showEdit || !data) && (
				<>
					<CGNeedsIntegrate
						cgType={cgType}
						onSubmit={async (cardID, pin) => {
							const res = await APIFetchV1(
								`/users/${user.id}/integrations/cg/${cgType}`,
								{
									method: "PUT",
									body: JSON.stringify({ cardID, pin }),
									headers: {
										"Content-Type": "application/json",
									},
								},
								true,
								true
							);

							if (res.success) {
								shouldReloadCardInfo();
							}
						}}
						initialCardID={data?.cardID ?? undefined}
						initialPin={data?.pin ?? undefined}
					/>
					<Divider />
				</>
			)}
			{data && (
				<CGImporter
					cgType={cgType}
					game={game}
					cardID={data.cardID}
					setShowEdit={setShowEdit}
					showEdit={showEdit}
				/>
			)}
		</>
	);
}

function CGImporter({
	cgType,
	game,
	cardID,
	showEdit,
	setShowEdit,
}: Pick<Props, "cgType" | "game"> & {
	cardID: string;
	showEdit: boolean;
	setShowEdit: SetState<boolean>;
}) {
	const importType: APIImportTypes = `api/cg-${cgType}-${game}`;
	const cgName = cgType === "dev" ? "CG Dev" : `CG ${cgType.toUpperCase()}`;

	const { importState, runImport } = useImport("/import/from-api", {
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
			<h2 className="text-center mb-4">
				Importing scores from {cgName} card{" "}
				<code>{cardID.match(/.{1,4}/gu)?.join(" ")}</code>{" "}
				<Icon
					onClick={() => setShowEdit(!showEdit)}
					type={showEdit ? "times" : "pencil-alt"}
					noPad
				/>
				.
			</h2>
			<Divider />
			<div className="d-flex w-100 justify-content-center">
				<Button
					className="mx-auto"
					variant="primary"
					onClick={() => runImport()}
					disabled={
						importState.state === "waiting_init" ||
						importState.state === "waiting_processing"
					}
				>
					{importState.state === "waiting_init" ||
					importState.state === "waiting_processing"
						? "Syncing..."
						: "Click to Sync!"}
				</Button>
			</div>
			<Divider />
			<div>
				Play on {cgName} a lot? You can synchronise your scores straight from the discord by
				typing <code>/sync</code>!
			</div>
			<Divider />
			<ImportStateRenderer state={importState} />
		</div>
	);
}

export function CGNeedsIntegrate({
	cgType,
	initialCardID,
	initialPin,
	onSubmit,
}: Pick<Props, "cgType"> & {
	onSubmit: (cardID: string, pin: string) => Promise<void>;
	initialCardID?: string;
	initialPin?: string;
}) {
	const cgName = cgType === "dev" ? "CG Dev" : "CG";

	const [cardID, setCardID] = useState(initialCardID ?? "");
	const [pin, setPin] = useState(initialPin ?? "");

	// strip any whitespace the user feels like entering
	const realCardID = useMemo(() => cardID.replace(/\s+/gu, ""), [cardID]);

	const shouldDisable = useMemo(() => {
		// yes i could turn this into a boolean with !
		// but have you *seen* how ugly that is?
		if (/^[0-9]{4}$/u.exec(pin) && /^[a-zA-Z0-9]{16}$/u.exec(realCardID)) {
			return false;
		}

		return true;
	}, [pin, realCardID]);

	return (
		<div>
			<h3 className="text-center mb-4">Set your {cgName} card.</h3>

			<FormInput fieldName="Card ID" setValue={setCardID} value={cardID} />
			<Form.Label>
				This is the card ID that's displayed in game. It should be 16 characters long.
				<br />
				{cardID.length > 0 && !/^[a-zA-Z0-9]{16}$/u.exec(realCardID) ? (
					<span className="text-danger">
						Invalid Card ID. This should be 16 alphanumeric characters.
					</span>
				) : (
					cardID.length > 0 && <span className="text-success">Looking good!</span>
				)}
			</Form.Label>
			<br />
			<FormInput fieldName="PIN" setValue={setPin} value={pin} type="password" />
			<Form.Label>What PIN do you use to card in to {cgName}?</Form.Label>
			<br />

			{pin.length > 0 && !/^[0-9]{4}$/u.exec(pin) ? (
				<span className="text-danger">Invalid PIN. This should be 4 digits.</span>
			) : (
				pin.length > 0 && <span className="text-success">Looking good!</span>
			)}

			<Divider />
			<div className="w-100 d-flex justify-content-center">
				<Button disabled={shouldDisable} onClick={() => onSubmit(realCardID, pin)}>
					Submit Card ID
				</Button>
			</div>
		</div>
	);
}
