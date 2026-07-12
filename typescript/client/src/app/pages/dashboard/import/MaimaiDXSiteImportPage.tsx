import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";

export default function MaimaiDXSiteImportPage() {
	useSetSubheader(["Import Scores", "maimai DX Site Importer"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the maimai DX Site Importer?</h1>
			<div>
				The maimai DX Site Importer is a script that will scrape your profile on the maimai
				DX website and import it to {TachiConfig.NAME}.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://github.com/j1nxie/kt-maimaidx-site-importer">
				the GitHub repository
			</ExternalLink>
			.
		</div>
	);
}
