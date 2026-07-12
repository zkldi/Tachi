import ImportSQLiteForm from "#components/imports/ImportSQLiteForm";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import { convertUSCDb } from "#util/db-converters/usc";
import React, { useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

export default function USCDBPage() {
	useSetSubheader(["Import Scores", "USC Database File"]);

	const [playtype, setPlaytype] = useState<"" | "Controller" | "Keyboard">("");

	return (
		<>
			<Alert variant="info">
				This method is intended for syncing up with existing scores. For new scores, you
				should set up the <Link to="/import/usc-ir">USC IR</Link> for automatic score
				uploading.
			</Alert>

			<ImportSQLiteForm
				convert={(dbs) => {
					if (playtype === "") {
						throw new Error("Please select an input device.");
					}
					const { result, warnings } = convertUSCDb(dbs.db!, playtype);
					return { results: result.scores.length > 0 ? [result] : [], warnings };
				}}
				extraControls={
					<Form.Group>
						<Form.Label>
							<strong>Input Device</strong>
						</Form.Label>
						<Form.Select
							onChange={(e) =>
								setPlaytype(e.target.value as "" | "Controller" | "Keyboard")
							}
							value={playtype}
						>
							<option value="">Please select…</option>
							<option value="Controller">Controller</option>
							<option value="Keyboard">Keyboard</option>
						</Form.Select>
						<Form.Text className="text-muted">
							Keyboard and Controller players are on separate leaderboards. Selecting
							the wrong one will cause problems.
						</Form.Text>
					</Form.Group>
				}
				extraValid={playtype !== ""}
				fileInputs={[{ key: "db", label: "USC maps.db" }]}
				name="USC Database Import"
			/>

			<Divider />
			<Muted>
				If you submit a score on a chart that the server doesn't recognise, you'll need to
				wait until at least 2 other players submit scores for that chart before it'll show
				up. This is to combat accidental IR spam.
			</Muted>
		</>
	);
}
