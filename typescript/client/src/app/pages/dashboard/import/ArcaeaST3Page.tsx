import ImportSQLiteForm from "#components/imports/ImportSQLiteForm";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { convertArcaeaDB } from "#util/db-converters/arcaea";
import React from "react";
import { Alert } from "react-bootstrap";

export default function ArcaeaST3Page() {
	useSetSubheader(["Import Scores", "Arcaea ST3 File"]);

	return (
		<>
			<Alert variant="info">
				Find the st3 file in your local savedata. You may need to use a rooted device or a
				backup.
			</Alert>
			<Alert variant="warning">
				This method is intended for syncing up with old (existing) scores. For new scores,
				seek a different method.
			</Alert>

			<ImportSQLiteForm
				convert={(dbs) => {
					const { result, warnings } = convertArcaeaDB(dbs.st3!);
					return { results: result.scores.length > 0 ? [result] : [], warnings };
				}}
				fileFormat=""
				fileInputs={[{ key: "st3", label: "Arcaea st3" }]}
				name="Arcaea Database Import"
			/>
		</>
	);
}
