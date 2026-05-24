import Card from "#components/layout/page/Card";
import Divider from "#components/util/Divider";
import Loading from "#components/util/Loading";
import { type ImportStates } from "#types/import";
import React from "react";

import ImportClassImportInfo from "./ImportClassImportInfo";

/** Post-submit card for **`/import/class`** (`file/import-class`) only. */
export default function ImportClassImportState({ state: s }: { state: ImportStates }) {
	return (
		<div className="row">
			<div className="col-12">
				<Card className="text-center" header="Class import">
					{s.state === "not_started" ? (
						<>Waiting for an import to start...</>
					) : s.state === "waiting_init" ? (
						<>
							<Loading />
							<div className="mt-2">We're processing your class import...</div>
						</>
					) : s.state === "waiting_processing" ? (
						<>
							<Loading />
							<div className="mt-2">We're processing your class import...</div>
							<Divider />
							<div>{s.progressInfo?.description ?? "Importing..."}</div>
						</>
					) : s.state === "done" ? (
						<>
							<div className="text-success fw-semibold">Import OK!</div>
							<Divider />
							<div className="text-start">
								<ImportClassImportInfo importDoc={s.import} />
							</div>
						</>
					) : (
						<>
							<div className="text-danger fw-semibold">Import not OK</div>
							<span className="text-danger">{s.error}</span>
						</>
					)}
				</Card>
			</div>
		</div>
	);
}
