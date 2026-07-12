import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { ToServerURL } from "#util/api";
import { Alert } from "react-bootstrap";

export default function USCIRPage() {
	useSetSubheader(["Import Scores", "USC IR"]);

	return (
		<div>
			<h2 className="text-center mb-4">USC IR Setup Instructions</h2>
			<ol className="instructions-list">
				<li>Open USC.</li>
				<li>Open Settings, and go to Online.</li>
				<Divider />
				<h3>
					<b>If you play on an Arcade Size Controller</b>
				</h3>
				<li>
					Fill out IR Base URL with <code>{ToServerURL("/ir/usc/Controller")}</code>.
				</li>
				<h3 className="mt-4">
					<b>
						If you play on Keyboard, Pocket Voltex or ANYTHING THAT IS NOT AN ARCADE
						SIZED CONTROLLER
					</b>
				</h3>
				<li>
					Fill out IR Base URL with <code>{ToServerURL("/ir/usc/Keyboard")}</code>.
				</li>
				<Alert className="mt-4" variant="danger">
					You <b>MUST</b> select the right IR! These leaderboards are separated because
					it's unfair to compare controller and keyboard scores.
					<br />
					Ignoring this will get you in trouble, please don't!
					<br />
					<br />
					<strong>Arcade-sized controllers</strong> should go on the controller
					leaderboards.
					<br />
					<strong>Keyboards and anything else</strong> go on the Keyboard/Other
					leaderboards.
				</Alert>
				<Divider />
				<li>
					Grab an API Token from{" "}
					<ExternalLink href="/client-file-flow/CXUSCIR">here</ExternalLink>, and place it
					in the API Token field.
				</li>
				<li>That's it! Your scores will now automatically upload to the server.</li>
			</ol>
		</div>
	);
}
