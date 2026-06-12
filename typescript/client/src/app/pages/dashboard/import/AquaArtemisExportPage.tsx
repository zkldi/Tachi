import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function AquaArtemisExport() {
	useSetSubheader(["Import Scores", "Aqua/ARTEMiS Exporter"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the Aqua/ARTEMiS Exporter?</h1>
			<div>
				The Aqua/Artemis Exporter is a script that will export your CHUNITHM scores from an
				Aqua/ARTEMiS instance to a BATCH-MANUAL JSON for import to {TachiConfig.NAME}. You
				will need direct access to the server instance.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://gist.github.com/beer-psi/52b0d0c85e20262ae3ab9b2c65effdda">
				the GitHub gist
			</ExternalLink>
			.
		</div>
	);
}
