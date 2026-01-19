import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import ExternalLink from "components/util/ExternalLink";
import Muted from "components/util/Muted";
import { TachiConfig } from "lib/config";
import React from "react";
import { Alert } from "react-bootstrap";

export default function ITGHookPage() {
	useSetSubheader(["Import Scores", "ITG Hook"]);

	return (
		<div>
			<h2 className="text-center mb-4">ITG Hook Setup Instructions</h2>
			<Alert variant="warning" style={{ fontSize: "3rem" }}>
				All submitted scores <b>should be played on a pad.</b>
			</Alert>
			<Alert variant="warning">
				Make sure you are running the following things:
				<ul>
					<li>ITGMania v0.5.1 or higher</li>
					<li>Simply Love</li>
					<li>
						Playing on <b>ITG</b> mode, (not <b>FA+</b>)
					</li>
				</ul>
				We will not ever be supporting Stepmania 5.1/OutFox/etc.
			</Alert>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>Tachi.lua</code>{" "}
					<ExternalLink href="https://github.com/zkldi/Simply-Love-Tachi-Module">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Place <code>Tachi.lua</code> inside <code>Themes/Simply Love/Modules</code>
				</li>
				<li>
					Get your <code>Tachi.json</code> file by clicking{" "}
					<ExternalLink href="/client-file-flow/CXITGHook">this link</ExternalLink>.
				</li>
				<li>
					Place this file inside your user profile. It should go next to
					<code>Groovestats.ini</code>.
				</li>
				<li>
					<strong style={{ fontSize: "1.15rem" }}>
						Edit <code>HttpAllowHosts=*.groovestats.com</code> in{" "}
						<code>Preferences.ini</code> to{" "}
						<code>HttpAllowHosts=*.boku.tachi.ac,boku.tachi.ac,*.groovestats.com</code>
					</strong>
				</li>
				<li>
					Make sure you are playing on <b>ITG</b> mode. <b>FA+</b> mode is not supported
					and will not work.
					<br />
					The FA+ window is built into the ITG mode now.
				</li>
				<li>That's it! Your scores should now automatically import.</li>
			</ol>
			<Divider />
			<Muted>
				Note: If you submit a score on a chart that {TachiConfig.NAME} doesn't recognise,
				we'll still store the score, but it won't appear until the chart is registered.
			</Muted>
		</div>
	);
}
