import ImportFileForm from "#components/imports/ImportFileForm";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import { convertYurisakiCSV } from "#util/db-converters/arcaea";
import React from "react";
import { Alert } from "react-bootstrap";

export default function ArcaeaYurisakiPage() {
	useSetSubheader(["Import Scores", "Arcaea Yurisaki"]);

	return (
		<>
			<Alert variant="warning">
				Use this method only if you're unable to use{" "}
				<a href="/import/arcaea-st3">the ST3 method</a>.
			</Alert>
			<Alert variant="info">
				Usage:
				<ol>
					<li>
						Add <a href="https://arcaea.yurisaki.top/bot">the Telegram bot</a>
					</li>
					<li>
						<code>/a bind &lt;friendcode&gt;</code>
					</li>
					<li>
						<code>/a account claim</code>
						<ul>
							<li>
								It will ask to switch to a specific parter in-game; you will need
								remove the favorite character temporarily
							</li>
							<li>
								<code>/a account check</code> when done.
							</li>
						</ul>
					</li>
					<li>
						<code>/a b30</code> (takes a while)
					</li>
					<li>
						<code>/a export</code>
					</li>
					<li>
						Extract <code>all_scores.csv</code>
					</li>
				</ol>
			</Alert>
			<Alert variant="warning">
				This method is intended for syncing up with old (existing) scores. Don't abuse the
				bot for new scores.
			</Alert>

			<ImportFileForm
				convert={(dbs) => {
					const csv = dbs["yurisaki-csv"];
					if (csv) {
						const { result, warnings } = convertYurisakiCSV(csv);
						return { results: result.scores.length > 0 ? [result] : [], warnings };
					}

					return { results: [], warnings: [] };
				}}
				fileFormat="csv"
				fileInputs={[{ key: "yurisaki-csv", label: "Yurisaki CSV" }]}
				name="Arcaea Database Import"
				type="plaintext"
			/>
		</>
	);
}
