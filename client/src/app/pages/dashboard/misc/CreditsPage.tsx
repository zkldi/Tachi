import { Contributors } from "util/constants/contributors";
import { RFA } from "util/misc";
import useSetSubheader from "components/layout/header/useSetSubheader";
import Divider from "components/util/Divider";
import { UserContext } from "context/UserContext";
import { TachiConfig } from "lib/config";
import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";

export default function CreditsPage() {
	useSetSubheader("Credits");

	const [alt, setAlt] = useState(false);
	const [whatTheHell, setWhatTheHell] = useState(0);

	const { user } = useContext(UserContext);

	function a(normal: JSX.Element | string, ...altStr: (JSX.Element | string)[]) {
		if (!alt) {
			return normal;
		} else if (whatTheHell < 0) {
			return normal;
		}

		return RFA(altStr);
	}

	return (
		<div style={{ fontSize: "1.15rem" }}>
			<p>
				{a(
					<>
						{TachiConfig.NAME} has been the work of many people, and many more
						contributors. None of this would be possible without these people.
					</>,
					"Funding for this program was made possible by by by by by-",
					`${TachiConfig.NAME} actually just appeared here one day, and we're not sure how.`,
					`Actually, we just ran npm install ${TachiConfig.NAME}.`,
					"To be honest, we had a surplus of monkeys and typewriters."
				)}
			</p>
			<Divider />
			<p>
				If you want to support {TachiConfig.NAME} development, see{" "}
				<Link to="/support">Support</Link>.
			</p>
			<Divider />

			<div className="mt-4">
				<h1 className="user-select-none">
					De
					<span
						className="credits-easter-egg"
						onClick={() => {
							if (alt) {
								// Force a different RFA
								// by incrementing a random
								// variable
								setWhatTheHell(whatTheHell + 1);
							} else {
								setAlt(true);
							}
						}}
					>
						v
					</span>{" "}
					Team
				</h1>

				<ul>
					<li>
						{a(
							"Lead Dev",
							"Rules Of Hooks Violator",
							"ABBA Enthusiast",
							"Nutcase",
							"IIDX 'player'"
						)}
						: <strong>zk</strong>
					</li>
					<li>
						{a(
							"Infrastructure & Dev/Ops",
							"Professional YAML Editor",
							"Professional nginx.conf Editor",
							"'What do you mean you rm -rf'd that folder?'",
							"WintOr",
							"Frog Lover"
						)}
						: <strong>winter</strong>
						<br />
						<small>Also the reason I even started learning how to program.</small>
					</li>
				</ul>
			</div>
			<div className="mt-6">
				<h1>Significant Contributors</h1>

				<p>
					These people have contributed a significant amount of their time to{" "}
					{TachiConfig.NAME}.
				</p>

				<ul>
					<li>
						{a(
							"Tachi Discord Bot Work + Homepage",
							"oooOoooo you want to use redux oooo",
							"Java Skirt Boy",
							"Urbit Enjoyer"
						)}
						: <strong>pfych</strong>
					</li>
					<li>
						{a("Mikado", "SDVX Pocky")}: <strong>adamaq01</strong>
					</li>
					<li>
						{a("Fervidex", "IIDX Black Magic")}: <strong>aixxe</strong>
					</li>
					<li>
						{a("Barbatos", "SDVX Black Magic")}: <strong>Arm1stice</strong>
					</li>
					<li>
						{a(
							"Graphic Design",
							"Adobe Suite Purchaser",
							"Squiggly Line Drawer",
							"Straight Line Drawer",
							"Ratboy Genius",
							"Large Headded Individual",
							"The Ace Of Craigs"
						)}
						: <strong>Craig</strong>
					</li>
					<li>
						{a(
							"Database Management, Various features, generally just a hell of a lot of work",
							"This guy put emojis in my codebase",
							"Emacs Evangelist"
						)}
						: <strong>cg505</strong>
					</li>
					<li>
						{a("KsHook", "Konaste Black Magic")}: <strong>Emma</strong>
					</li>
					<li>
						{a("APIs, Databasing", "All Black Magic")}: <strong>Felix</strong>
					</li>
					<li>
						{a("APIs, Massive Dev Support", "Have you tried Elixir?")}:{" "}
						<strong>haste</strong>
					</li>
					<li>
						{a("Chunitachi", "CHUNITHM Black Magic")}: <strong>tomatosoup</strong>
					</li>
					<li>
						{a(
							"Dev, Maths Consultation",
							"Functional Programming Evangelist",
							"Born On The Cob",
							"Crunchy Nut Enjoyer",
							"Has An Afro"
						)}
						: <strong>Percyqaz</strong>
					</li>
					<li>
						{a("Server", "Ethereum Mining Solutions")}: <strong>viddy</strong>
						<br />
						<small>Yes, the entire server, networking costs, everything.</small>
					</li>
				</ul>
			</div>
			<div className="mt-6">
				<h1>Contributors</h1>

				<p>These people have contributed to {TachiConfig.NAME}.</p>

				<ul>
					{Contributors.slice(0)
						.sort((a, b) => a.localeCompare(b))
						.map((e) => (
							<li key={e}>{e}</li>
						))}
				</ul>
			</div>
			<div className="mt-6">
				<h1>And...</h1>

				<p>
					Everyone who was part of the beta.
					{user?.badges.some((x) => x === "beta" || x === "alpha")
						? " (That's you!)"
						: ""}
				</p>

				<p>
					Everyone in the <code>#dev</code> chat for the constant advice and comedy gold.
				</p>
			</div>
			<span className="text-body-secondary" style={{ fontSize: "0.2rem" }}>
				Click the V in Dev Team.
			</span>
		</div>
	);
}
