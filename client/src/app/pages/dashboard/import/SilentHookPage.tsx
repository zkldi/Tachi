import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import Muted from "components/util/Muted";
import { TachiConfig } from "lib/config";
import React from "react";
import Alert from "react-bootstrap/Alert";

export default function SilentHookPage() {
	useSetSubheader(["Import Scores", "Silent Hook"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is Silent Hook?</h1>
			<div>
				Silent Hook is a <code>.dll</code> file that hooks into Pop'n and automatically
				sends the scores to a server. {TachiConfig.NAME} is compatible with what the Silent
				Hook sends, so you can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download <code>silent</code> from{" "}
					<ExternalLink href="https://zkldi.com/stuff/silent-latest.zip">
						here
					</ExternalLink>{" "}
					and place all the <code>.dll</code> files in the same folder as{" "}
					<code>popn22.dll</code>.
					<br />
					<Muted>The above download is for Kaimei Riddles.</Muted>
				</li>
				<li>
					Download your config file to the same folder{" "}
					<ExternalLink href="/client-file-flow/CXSilentHook">here</ExternalLink>
					. <br />
					<Alert variant="warning" className="mt-2">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>
					Add <code>silent</code> to your startup script as a hook.
					<ul className="instructions-list">
						<li>
							BemaniTools5: Add <code>-K silent.dll</code> to your <code>.bat</code>{" "}
							file.
						</li>
						<li>
							SpiceTools &amp; BemaniTools4: Add <code>-k silent.dll</code> to your{" "}
							<code>.bat</code> file.
						</li>
					</ul>
				</li>
				<li>Your scores now automatically upload to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
