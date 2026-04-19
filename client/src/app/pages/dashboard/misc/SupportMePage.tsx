import useSetSubheader from "components/layout/header/useSetSubheader";
import ExternalLink from "components/util/ExternalLink";
import { TachiConfig } from "lib/config";
import React from "react";
import { Link } from "react-router-dom";

export default function SupportMePage() {
	useSetSubheader("Support");

	return (
		<div style={{ fontSize: "1.15rem" }}>
			<p>
				{TachiConfig.NAME} is a passion project, and developed by{" "}
				<Link to="/credits">people like you</Link>.
			</p>
			<p>
				You can star the{" "}
				<ExternalLink href="https://github.com/zkldi/Tachi">GitHub Repo</ExternalLink>. This
				makes me look cool to employers!
			</p>
		</div>
	);
}
