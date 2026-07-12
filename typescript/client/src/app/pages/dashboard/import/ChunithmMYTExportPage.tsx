import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function ChunithmMYTExport() {
	useSetSubheader(["Import Scores", "CHUNITHM MYT Exporter"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the CHUNITHM Mythos Exporter?</h1>
			<div>
				The CHUNITHM Mythos Exporter is an userscript that will export your CHUNITHM scores
				from MYT to a BATCH-MANUAL JSON for import to {TachiConfig.NAME}.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://gist.github.com/beer-psi/90e7df9c6aacc5a295eb5a90dbd8d537">
				the GitHub gist
			</ExternalLink>
			.
		</div>
	);
}
