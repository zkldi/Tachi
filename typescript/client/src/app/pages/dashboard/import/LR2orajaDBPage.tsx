import ImportSQLiteForm from "#components/imports/ImportSQLiteForm";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import { convertBeatorajaDb } from "#util/db-converters/beatoraja";
import React from "react";
import { Link } from "react-router-dom";

export default function LR2orajaDBPage() {
	useSetSubheader(["Import Scores", "LR2oraja Database File"]);

	return (
		<>
			<ImportSQLiteForm
				convert={(dbs) => {
					const { k7, k14, warnings } = convertBeatorajaDb(dbs.score!, dbs.chart!);
					const results = [k7, k14].filter((r) => r !== null);
					return { results, warnings };
				}}
				fileInputs={[
					{ key: "score", label: "Beatoraja score.db" },
					{ key: "chart", label: "Beatoraja songdata.db" },
				]}
				name="LR2oraja (Beatoraja) Database Import"
			/>

			<Divider />
			<Muted>
				This method is intended for syncing up with existing scores. For new scores, you
				should set up the <Link to="/import/beatoraja-ir">LR2oraja IR</Link> for automatic
				score uploading.
			</Muted>
			<br />
			<Muted>
				Note: If you submit a score on a chart that the server doesn't recognise, you'll
				need to wait until at least 2 other players submit scores for that chart before
				it'll show up. This is to combat accidental IR spam.
			</Muted>
		</>
	);
}
