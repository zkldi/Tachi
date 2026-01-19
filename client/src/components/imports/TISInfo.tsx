import ExternalLink from "components/util/ExternalLink";
import { TachiConfig } from "lib/config";
import React from "react";

export default function TISInfo({ name }: { name: string }) {
	return (
		<div>
			<h2 className="text-center mb-4">Importing {name} files</h2>
			<ol className="instructions-list">
				<li>
					Download the latest version of the {TachiConfig.NAME} Import Scripts{" "}
					<ExternalLink href="https://github.com/zkldi/Tachi-import-scripts/releases">
						here
					</ExternalLink>
					.
				</li>
				<li>Follow the instructions in-client.</li>
				<li>
					Click import! The scripts will convert the file and submit it to{" "}
					{TachiConfig.NAME}.
				</li>
			</ol>
		</div>
	);
}
