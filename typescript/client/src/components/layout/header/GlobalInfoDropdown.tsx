import DropdownNavLink from "#components/ui/DropdownNavLink";
import QuickDropdown from "#components/ui/QuickDropdown";
import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";
import { FormatGame, GetGameGroupConfig, LEGACY_GameGroupPTToGame } from "tachi-common";

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

	for (const game of TachiConfig.GAME_GROUPS) {
		const gameConfig = GetGameGroupConfig(game);

		for (const playtype of gameConfig.playtypes) {
			links.push(
				<DropdownNavLink
					key={`${game}:${playtype}`}
					onClick={() => setState?.(false)}
					to={`/games/${LEGACY_GameGroupPTToGame(game, playtype)}`}
				>
					{FormatGame(LEGACY_GameGroupPTToGame(game, playtype))}
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
