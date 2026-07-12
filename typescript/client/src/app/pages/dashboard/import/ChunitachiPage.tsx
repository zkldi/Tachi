import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";

export default function ChunitachiPage() {
	useSetSubheader(["Import Scores", "Chunitachi"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is Chunitachi?</h1>
			<div>
				Chunitachi is a <code>.dll</code> file that hooks into CHUNITHM and automatically
				sends the scores to a server. {TachiConfig.NAME} is compatible with what Chunitachi
				sends, so you can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download <code>chunitachi.dll</code> from{" "}
					<ExternalLink href="https://github.com/tomatosoupcan/ChunItachi/releases">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your <code>ChunItachi.ini</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXChunitachi">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This config file contains an API Key, which should be kept secret!
					</Alert>
				</li>
				<li>
					Follow the remaining install instructions on{" "}
					<ExternalLink href="https://github.com/tomatosoupcan/ChunItachi/blob/main/README.md">
						GitHub
					</ExternalLink>
					.
				</li>
				<li>That's it! Your scores should now automatically submit to the server.</li>
			</ol>
		</div>
	);
}
