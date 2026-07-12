import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";

export default function SaekawaPage() {
	useSetSubheader(["Import Scores", "Saekawa"]);

	return (
		<div>
			<h1 className="text-center mb-4">What is Saekawa?</h1>
			<div>
				Saekawa is a <code>.dll</code> file that hooks into CHUNITHM and automatically sends
				scores to a server. {TachiConfig.NAME} is compatible with what Saekawa sends, so you
				can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>saekawa.dll</code> from{" "}
					<ExternalLink href="https://github.com/beer-psi/saekawa/releases/latest">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your <code>saekawa.toml</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXSaekawa">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>
					Follow the remaining install instructions on{" "}
					<ExternalLink href="https://github.com/beer-psi/saekawa/blob/trunk/README.md">
						GitHub
					</ExternalLink>
					.
				</li>
				<li>Your scores and dans now automatically upload to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
