import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function ChunithmSiteImportPage() {
	useSetSubheader(["Import Scores", "CHUNITHM Site Importer"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the CHUNITHM DX site importer?</h1>
			<div>
				The CHUNITHM Site Importer is a script that will scrape your profile on the CHUNITHM
				website and import it to {TachiConfig.NAME}.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://github.com/beer-psi/kt-chunithm-site-importer">
				the GitHub repository
			</ExternalLink>
			.
		</div>
	);
}
