import { Link } from "react-router-dom";

import QuickTooltip from "../misc/QuickTooltip";

export default function CardNavButton({
	type,
	to,
	hoverText,
}: {
	hoverText?: string;
	to: string;
	type: string;
}) {
	if (!hoverText) {
		return <Link className={`fas fa-${type} h3 card-nav-icon`} to={to} />;
	}

	return (
		<QuickTooltip tooltipContent={hoverText}>
			<Link className={`fas fa-${type} h3 card-nav-icon`} to={to} />
		</QuickTooltip>
	);
}
