import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";

export default function OngekiInoharaPage() {
	useSetSubheader(["Import Scores", "Inohara"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is Inohara?</h1>
			<div>
				Inohara automatically sends O.N.G.E.K.I. scores to a server. {TachiConfig.NAME} is
				compatible with what Inohara sends, so you can use her to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>inohara.zip</code>{" "}
					<ExternalLink href="https://gitea.tendokyu.moe/akanyan/inohara/releases">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your <code>inohara.cfg</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXInohara">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>
					Follow the installation instructions on{" "}
					<ExternalLink href="https://gitea.tendokyu.moe/akanyan/inohara/src/branch/main/README.md#installation">
						Tendokyu
					</ExternalLink>
					.
				</li>
				<li>Your scores are now automatically uploaded to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
