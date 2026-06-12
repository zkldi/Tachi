import DropdownNavLink from "#components/ui/DropdownNavLink";
import QuickDropdown from "#components/ui/QuickDropdown";
import { type SetState } from "#types/react";
import { ALL_GAMES, FormatGame, type UserDocument, type UserGameStats } from "tachi-common";

export default function UserGameDropdown({
	user,
	ugs,
	className,
	menuClassName,
	style,
	setState,
}: {
	className?: string;
	menuClassName?: string;
	setState?: SetState<boolean>;
	style?: React.CSSProperties;
	ugs: UserGameStats[];
	user: UserDocument;
}) {
	const userProfileLinks = [];

	if (user && ugs && ugs.length !== 0) {
		const ugsMap = new Map(ugs.map((s) => [s.game, s] as const));

		for (const game of ALL_GAMES) {
			const e = ugsMap.get(game);

			if (!e) {
				continue;
			}

			userProfileLinks.push(
				<DropdownNavLink
					key={e.game}
					onClick={() => {
						setState?.(false);
					}}
					to={`/u/${user.username}/games/${e.game}`}
				>
					{FormatGame(e.game)}
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
			toggle="Your Profiles"
			variant="clear"
		>
			{userProfileLinks}
		</QuickDropdown>
	);
}
