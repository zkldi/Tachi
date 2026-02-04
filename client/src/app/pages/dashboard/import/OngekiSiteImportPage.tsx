import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import { TachiConfig } from "lib/config";
import React from "react";

export default function OngekiSiteImportPage() {
	useSetSubheader(["Import Scores", "O.N.G.E.K.I. Site Importer"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the O.N.G.E.K.I. Site Importer?</h1>
			<div>
				The O.N.G.E.K.I. Site Importer is a script that will scrape your profile on the
				O.N.G.E.K.I. website and import it to {TachiConfig.NAME}.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://github.com/umi4life/kt-ongeki-site-importer">
				the GitHub repository
			</ExternalLink>
			.
		</div>
	);
}
