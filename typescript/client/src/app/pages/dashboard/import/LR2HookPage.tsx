import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import Muted from "#components/util/Muted";
import { TachiConfig } from "#lib/config";
import { Alert } from "react-bootstrap";

export default function LR2HookPage() {
	useSetSubheader(["Import Scores", "LR2 Hook"]);

	return (
		<div>
			<Alert variant="warning">
				{TachiConfig.NAME} <b>DOES NOT</b> officially support LR2.
				<br />
				This hook is provided by a community member. Please do not report issues with LR2 to
				us.
				<br />
				Unless you have a <b>really</b> good reason, please use LR2oraja instead.
			</Alert>
			<h2 className="text-center mb-4">LR2 Hook Setup Instructions</h2>
			<ol className="instructions-list">
				<li>
					Download the latest version of the LR2Hook{" "}
					<ExternalLink href="https://github.com/MatVeiQaaa/BokutachiHook/releases">
						here
					</ExternalLink>{" "}
					and lr2_chainload{" "}
					<ExternalLink href="https://github.com/SayakaIsBaka/lr2_chainload/releases">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Place all of those files in the same folder as <b>LR2Body.exe</b>.
				</li>
				<li>
					Get your <code>BokutachiAuth.json</code> file by clicking{" "}
					<ExternalLink href="/client-file-flow/CXLR2Hook">this link</ExternalLink>.
				</li>
				<li>
					Place this file in the same folder as <b>LR2Body.exe</b>.
				</li>
				<li>
					Create file named <b>chainload.txt</b> in the same folder as <b>LR2Body.exe</b>{" "}
					and add new line "BokutachiHook.dll" into it.
				</li>
				<li>
					That's it! Launch the game as usual, your scores will automatically submit to
					the server.
				</li>
			</ol>
			<Divider />
			<Muted>
				Note: If you submit a score on a chart that {TachiConfig.NAME} doesn't recognise,
				you'll need to wait until at least 2 other players submit scores for that chart
				before it'll show up. This is to combat accidental IR spam.
			</Muted>
		</div>
	);
}
