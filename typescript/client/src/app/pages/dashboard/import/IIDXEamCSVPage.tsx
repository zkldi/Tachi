import ImportFileInfo, { type MoreDataForm } from "#components/imports/ImportFileInfo";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import React, { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { type FileUploadImportTypes } from "tachi-common";

export default function IIDXEamCSVPage({
	name,
	importType,
}: {
	importType: FileUploadImportTypes;
	name: string;
}) {
	useSetSubheader(["Import Scores", name]);

	return (
		<ImportFileInfo
			acceptMime="text/csv"
			importType={importType}
			MoreDataForm={MoreDataFormComponent}
			name={name}
			parseFunction={ParseFunction}
		/>
	);
}

const MoreDataFormComponent: MoreDataForm = ({ setFulfilled, setInfo }) => {
	const [state, setState] = useState<Record<string, string>>({});

	useEffect(() => {
		setInfo(state);
	}, [setInfo, state]);

	return (
		<>
			<div className="alert alert-danger">
				Selecting your playtype here is <b>SUPER</b> important.
				<br />
				There is <b>ABSOLUTELY NO WAY</b> to know whether an e-am CSV is for SP or DP from
				the file alone.
				<br />
				If you input the wrong playtype here, you will corrupt your account. I'm serious.
				Don't make that mistake.
			</div>
			<Form.Select
				onChange={(e) => {
					const playtype = e.target.value;

					if (playtype === "") {
						setFulfilled(false);
					} else {
						setState({ ...state, playtype });
						setFulfilled(true);
					}
				}}
			>
				<option value="">Please select a playtype.</option>
				<option value="SP">SP</option>
				<option value="DP">DP</option>
			</Form.Select>
			<Form.Group className="mt-4">
				<Form.Check
					checked={!!state.assertPlaytypeCorrect}
					label="Disable Filename Checks"
					onChange={(e) => {
						setState({
							...state,
							assertPlaytypeCorrect: e.target.checked ? "true" : "",
						});
					}}
					type="checkbox"
				/>
				<Form.Text>
					<span className="text-warning">
						This will disable a safety feature of checking the uploaded filename for
						"SP" or "DP", and prevent you from accidentally selecting the wrong
						playtype.
						<br />
						Use this only if you get errors normally.
					</span>
				</Form.Text>
			</Form.Group>
		</>
	);
};

const PRE_HV_HEADER_COUNT = 27;
const HV_HEADER_COUNT = 41;

function ParseFunction(data: string) {
	const lines: string[] = data.split("\n");

	const headers = lines[0]!.split(",");

	if (headers.length !== HV_HEADER_COUNT && headers.length !== PRE_HV_HEADER_COUNT) {
		throw new Error(
			`Unexpected amount of headers in the file -- Expected ${HV_HEADER_COUNT} or ${PRE_HV_HEADER_COUNT}, received ${headers.length}. Is this an eamusement CSV?`,
		);
	}

	if (lines.length === 1) {
		throw new Error(`This CSV has no scores? Only found headers.`);
	}

	// check for nonsense non-zero EX stuff with zero judgements

	for (const line of lines) {
		const cells = line.split(",");
		for (let i = 0; i < 5; i++) {
			const di = 5 + i * 7;

			const exscore = cells[di + 1]!;
			const pgreat = cells[di + 2]!;
			const great = cells[di + 3]!;

			if (Number(exscore) && Number(pgreat) === 0 && Number(great) === 0) {
				throw new Error(
					`Invalid CSV. This CSV does not have PGREAT/GREAT information, which we use to sanity check scores. If this is from Fervidex you can enable "Sync Existing Scores" and boot the game instead.`,
				);
			}
		}
	}

	const linesWithScores = lines.filter((e) => e !== "");

	return {
		valid: true,
		info: {
			Scores: linesWithScores.length - 1,
			"Game Version": linesWithScores[linesWithScores.length - 1]!.split(",")[0],
		},
	};
}
