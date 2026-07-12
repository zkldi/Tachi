import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function OngekiArtemisExportPage() {
	useSetSubheader(["Import Scores", "O.N.G.E.K.I. ARTEMiS Exporter"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the ARTEMiS Exporter?</h1>
			<div>
				The Artemis Exporter is a script that will export your O.N.G.E.K.I. scores from an
				ARTEMiS instance to a BATCH-MANUAL JSON for import to {TachiConfig.NAME}. You will
				need direct access to the server instance.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://gist.github.com/nyairobi/ffdf9e674f31987b1ffbd38d31b55f6c">
				the GitHub gist
			</ExternalLink>
			.
		</div>
	);
}
