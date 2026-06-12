import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";

export default function KsHookPage() {
	useSetSubheader(["Import Scores", "Konaste Hook"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is Konaste Hook?</h1>
			<div>
				Konaste Hook is a <code>.dll</code> file that hooks into SDVX and automatically
				sends the scores to a server. {TachiConfig.NAME} is compatible with what Konaste
				Hook sends, so you can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>kshook.dll</code> from{" "}
					<ExternalLink href="https://djtrackers.com/kshook/latest.zip">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your config file{" "}
					<ExternalLink href="/client-file-flow/CXKsHook">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>Place all of these files inside your SDVX6 (EAC) folder.</li>
				<li>
					Use <b>kshook.exe</b> to launch the game. It will open the usual login page, but
					when the game is launched the hook will be loaded.
					<br />
					It is recommended you replace your existing shortcuts with <b>kshook.exe</b>{" "}
					instead.
				</li>
				<li>Your scores now automatically upload to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
