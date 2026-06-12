import useSetSubheader from "#components/layout/header/useSetSubheader";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import { TachiConfig } from "#lib/config";
import Alert from "react-bootstrap/Alert";

export default function MikadoPage() {
	useSetSubheader(["Import Scores", "Mikado"]);

	return (
		<div>
			<h1 className="text-center mb-4">What Is Mikado?</h1>
			<div>
				Mikado is a <code>.dll</code> file that hooks into SDVX and automatically sends
				scores to a server. {TachiConfig.NAME} is compatible with what Mikado sends, so you
				can use it to submit scores!
			</div>
			<Divider />
			<h1 className="text-center my-4">Setup Instructions</h1>
			<ol className="instructions-list">
				<li>
					Download the latest version of <code>mikado.dll</code> from{" "}
					<ExternalLink href="https://github.com/adamaq01/mikado/releases/latest">
						here
					</ExternalLink>
					.
				</li>
				<li>
					Download your <code>mikado.toml</code> config file{" "}
					<ExternalLink href="/client-file-flow/CXMikado">here</ExternalLink>. <br />
					<Alert className="mt-2" variant="warning">
						This file contains an API Key, which is meant to be kept secret!
					</Alert>
				</li>
				<li>
					Drop both files inside your SDVX folder, next to your <code>.bat</code> file.
				</li>
				<ul className="instructions-list">
					<li>
						BemaniTools: Add <code>-K mikado.dll</code> to your <code>.bat</code> file.
					</li>
					<li>
						SpiceTools: Add <code>-k mikado.dll</code> to your <code>.bat</code> file.
					</li>
				</ul>
				<li>Your scores and dans now automatically upload to {TachiConfig.NAME}!</li>
			</ol>
		</div>
	);
}
