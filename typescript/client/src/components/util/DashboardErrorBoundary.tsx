import React from "react";

import CenterPage from "./CenterPage";
import DebugContent from "./DebugContent";
import Divider from "./Divider";
import ExternalLink from "./ExternalLink";
import Muted from "./Muted";

export default class DashboardErrorBoundary extends React.Component<
	any,
	{ error: any; info: any }
> {
	constructor(props: any) {
		super(props);
		this.state = { error: null, info: null };
	}

	componentDidCatch(error: any, info: any) {
		console.error(error, info);
		this.setState({ error, info });
	}

	render() {
		if (this.state.error) {
			return (
				<CenterPage>
					<h1>Whoops!</h1>
					<br />
					<h4>
						A fatal error has occurred in rendering this page. You should report this!
					</h4>
					<Divider />
					<h3 className="mb-2">Error Log</h3>
					<div style={{ fontSize: "1rem", width: "80vw", height: "400px" }}>
						<DebugContent
							data={{ error: this.state.error.message, info: this.state.info }}
						/>
					</div>
					<Divider />
					<Muted>This error is not recoverable. :/</Muted>
					<Divider />
					<a href="#" onClick={() => window.location.reload()}>
						Attempt Page Reload
					</a>
					<ExternalLink href="/">Go Home</ExternalLink>
				</CenterPage>
			);
		}

		return this.props.children;
	}
}
