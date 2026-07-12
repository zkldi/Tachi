import Icon from "#components/util/Icon";
import React, { Fragment } from "react";
import { Link } from "react-router-dom";

export function Breadcrumbs({ items }: { items: string[] }) {
	const url = location.pathname;

	// we also need to remove the first param, as it is an empty string
	const parts = url.split("/").slice(1);

	return (
		<div className="d-none d-lg-flex align-items-center fw-semibold">
			<Link
				aria-label="Home"
				className="p-1 rounded link-body-emphasis link-opacity-75 link-opacity-100-hover focus-visible-ring transition-color"
				to="/"
			>
				<Icon type="home" />
			</Link>
			{items.map((name, index) => {
				// Skip playtype in the breadcrumbs if the game only has one playtype.
				// @hack
				// this only works if the game has one playtype called "Single".
				// Some games (like pop'n) have one playtype, but it's called
				// 9B. They'll just have to cope.
				if (items[index - 2] === "Games" && name === "Single") {
					return;
				}

				return (
					<Fragment key={index}>
						<span
							className="h-2 w-2 d-block bg-body-emphasis rounded-circle bg-opacity-75 mx-3"
							id="dot"
						/>
						<Link
							className="p-1 rounded text-decoration-none link-body-emphasis link-opacity-75 link-opacity-100-hover focus-visible-ring transition-color"
							to={`/${parts.slice(0, index + 1).join("/")}`}
						>
							{name}
						</Link>
					</Fragment>
				);
			})}
		</div>
	);
}
