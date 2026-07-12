import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";
import { Link } from "react-router-dom";

export default function FervidexPage() {
	useSetSubheader(["Import Scores", "Fervidex"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is Fervidex?</h1>
			<div>
				Fervidex is a <code>.dll</code> file that hooks into IIDX and automatically sends
				the scores to a server. {TachiConfig.NAME} is compatible with what Fervidex sends,
				so you can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download <code>fervidex.dll</code> from{" "}
					<ExternalLink href="https://client.fervidex.net/latest.zip">here</ExternalLink>.
				</li>
				<li>
					Download your <code>kamaitachi.fervidex.json</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXFervidex">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This config file contains an API Key, which should be kept secret!
					</Alert>
				</li>
				<li>
					Drop both files into the same folder as your <code>bm2dx.dll</code>.
				</li>
				<h3 className="my-2">For Infinitas Players</h3>
				<ul className="instructions-list">
					<li>
						You'll also need to download{" "}
						<ExternalLink href="https://client.fervidex.net/latest-chainloader.zip">
							this
						</ExternalLink>
						, and extract it to the same folder.
					</li>
				</ul>
				<h3 className="my-2">For Not-Infinitas Players</h3>
				<ul className="instructions-list">
					<li>
						BemaniTools: Add <code>-K fervidex.dll</code> to your <code>.bat</code>{" "}
						file.
					</li>
					<li>
						SpiceTools: Add <code>-k fervidex.dll</code> to your <code>.bat</code> file.
					</li>
				</ul>
				<li>That's it! Your scores should now automatically submit to the server.</li>
			</ol>
			<Alert variant="warning">
				Looking to import existing scores? Import from your network first. If that's not
				possible, enable "Sync Existing Scores" in{" "}
				<Link to={"/u/me/integrations/services/fervidex"}>
					<b>your settings.</b>
				</Link>
			</Alert>
		</div>
	);
}
