import DropdownNavLink from "#components/ui/DropdownNavLink";
import QuickDropdown from "#components/ui/QuickDropdown";
import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";
import { GetGameGroupConfig } from "tachi-common";

export default function ImportScoresLink({
	className,
	menuClassName,
	style,
	setState,
}: {
	className?: string;
	menuClassName?: string;
	setState?: SetState<boolean>;
	style?: React.CSSProperties;
}) {
	const links = [];

	for (const game of TachiConfig.GAME_GROUPS) {
		const gameConfig = GetGameGroupConfig(game);

		links.push(
			<DropdownNavLink
				isActive={() => {
					const queryGame = new URLSearchParams(window.location.search).get("game");
					return queryGame === game;
				}}
				key={game}
				onClick={() => setState?.(false)}
				to={`/import?game=${game}`}
			>
				{gameConfig.name}
			</DropdownNavLink>,
		);
	}

	return (
		<QuickDropdown
			caret
			className={`h-14 ${className}`}
			menuClassName={menuClassName}
			menuStyle={style}
			toggle="Import Scores"
			variant="clear"
		>
			{links}
		</QuickDropdown>
	);
}
