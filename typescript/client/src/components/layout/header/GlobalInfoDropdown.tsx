import DropdownNavLink from "#components/ui/DropdownNavLink";
import QuickDropdown from "#components/ui/QuickDropdown";
import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";
import { FormatGame, GetGameGroupConfig } from "tachi-common";

export default function GlobalInfoDropdown({
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

	for (const gameGroup of TachiConfig.GAME_GROUPS) {
		const gameConfig = GetGameGroupConfig(gameGroup);

		for (const game of gameConfig.games) {
			links.push(
				<DropdownNavLink key={game} onClick={() => setState?.(false)} to={`/games/${game}`}>
					{FormatGame(game)}
				</DropdownNavLink>,
			);
		}
	}

	return (
		<QuickDropdown
			caret
			className={`h-14 ${className}`}
			menuClassName={menuClassName}
			menuStyle={style}
			toggle="Global Info"
			variant="clear"
		>
			{links}
		</QuickDropdown>
	);
}
