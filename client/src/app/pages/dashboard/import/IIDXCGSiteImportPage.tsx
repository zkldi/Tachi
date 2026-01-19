import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import { TachiConfig } from "lib/config";
import React from "react";

export default function IIDXCGSiteImportPage() {
	useSetSubheader(["Import Scores", "IIDX CG Site Importer"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is the IIDX CG Site Importer?</h1>
			<div>
				The IIDX CG Site Importer is a script that will scrape your IIDX profile on a CG
				instance's website and import it to {TachiConfig.NAME}.
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			Instructions are available on{" "}
			<ExternalLink href="https://github.com/tranq88/kt-cg-iidx-importer">
				the GitHub repository
			</ExternalLink>
			.
		</div>
	);
}
