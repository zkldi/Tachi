import QuickTooltip from "#components/layout/misc/QuickTooltip";
import { GAME_CLIENT_IMPLEMENTATIONS } from "#lib/game-implementations";
import { type GameProps } from "#types/react";
import { UppercaseFirst } from "#util/misc";
import { Badge } from "react-bootstrap";
import { type Classes, GetGameConfig, type V3Game } from "tachi-common";

export default function ClassBadge<TGame extends V3Game = V3Game>({
	game,
	classSet,
	classValue,
	showSetOnHover = true,
}: {
	classSet: Classes[TGame];
	classValue: string;
	showSetOnHover?: boolean;
} & GameProps) {
	const classStyle =
		// @ts-expect-error complex indexed types
		GAME_CLIENT_IMPLEMENTATIONS[game].classColours[classSet][classValue];

	const data = GetGameConfig(game).classes[classSet].values.find((e) => e.id === classValue);

	if (!data) {
		return (
			<>
				{classSet} {classValue} (messed up!)
			</>
		);
	}

	let badgeComponent;

	if (classStyle === null) {
		badgeComponent = (
			<Badge bg="dark" className="mx-2">
				{data.display}
			</Badge>
		);
	} else if (typeof classStyle === "string") {
		badgeComponent = (
			<Badge bg={classStyle} className="mx-2">
				{data.display}
			</Badge>
		);
	} else {
		const styleWithMaybeShine = classStyle as { shine?: boolean } & React.CSSProperties;
		const { shine, ...badgeStyle } = styleWithMaybeShine;
		badgeComponent = (
			<Badge bg={""} className={`mx-2${shine ? " shine" : ""}`} style={badgeStyle}>
				{data.display}
			</Badge>
		);
	}

	if (data.hoverText && showSetOnHover) {
		return (
			<QuickTooltip tooltipContent={`${UppercaseFirst(classSet)}: ${data.hoverText}`}>
				{badgeComponent}
			</QuickTooltip>
		);
	} else if (data.hoverText) {
		return <QuickTooltip tooltipContent={data.hoverText}>{badgeComponent}</QuickTooltip>;
	} else if (showSetOnHover) {
		return (
			<QuickTooltip tooltipContent={UppercaseFirst(classSet)}>{badgeComponent}</QuickTooltip>
		);
	}

	return badgeComponent;
}
