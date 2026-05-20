import ImportSQLiteForm from "#components/imports/ImportSQLiteForm";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import Muted from "#components/util/Muted";
import { convertLR2Db } from "#util/db-converters/lr2";
import React from "react";

export default function LR2DBPage() {
	useSetSubheader(["Import Scores", "LR2 Database File"]);

	return (
		<>
			<ImportSQLiteForm
				convert={(dbs) => {
					const { k7, k14, warnings } = convertLR2Db(dbs.score!, dbs.chart!);
					const results = [k7, k14].filter((r) => r !== null);
					return { results, warnings };
				}}
				fileInputs={[
					{ key: "score", label: "LR2 Scores/<username>.db" },
					{ key: "chart", label: "LR2 song.db" },
				]}
				name="LR2 Database Import"
			/>

			<Divider />
			<Muted>
				Note: If you submit a score on a chart that the server doesn't recognise, you'll
				need to wait until at least 2 other players submit scores for that chart before
				it'll show up. This is to combat accidental IR spam.
			</Muted>
		</>
	);
}
