import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import { TachiConfig } from "lib/config";
import React from "react";
import Alert from "react-bootstrap/Alert";

export default function RizuPage() {
	useSetSubheader(["Import Scores", "Rizu"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is Rizu?</h1>
			<div>
				Rizu automatically sends maimai DX scores to a server. {TachiConfig.NAME} is
				compatible with what Rizu sends, so you can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>Rizu-MelonLoader-vVERSION.zip</code>{" "}
					<ExternalLink href="https://gitea.tendokyu.moe/beerpsi/Rizu/releases/latest">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your <code>Rizu.cfg</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXRizu">here</ExternalLink>
					. <br />
					<Alert variant="warning" className="mt-2">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>
					Follow the installation instructions on{" "}
					<ExternalLink href="https://gitea.tendokyu.moe/beerpsi/Rizu#melonloader">
						Tendokyu
					</ExternalLink>
					.
				</li>
				<li>Your scores are now automatically uploaded to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
