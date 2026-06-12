import useApiQuery from "#components/util/query/useApiQuery";
import { AllYourUGStatsContext } from "#context/AllYourUGStatsContext";
import { UserContext } from "#context/UserContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { TachiConfig } from "#lib/config";
import { type SetState } from "#types/react";
import { useContext, useEffect } from "react";
import Nav from "react-bootstrap/Nav";
import { NavLink } from "react-router-dom";
import { type UserGameStats } from "tachi-common";

import GlobalInfoDropdown from "./GlobalInfoDropdown";
import ImportScoresDropdown from "./ImportScoresDropdown";
import UserGameDropdown from "./UserGameDropdown";

const toggleClassNames = "w-100 justify-content-between";
const menuClassNames = "shadow-none shadow-lg-lg";

export function HeaderMenu({
	dropdownMenuStyle,
	setState,
}: {
	dropdownMenuStyle?: React.CSSProperties;
	setState?: SetState<boolean>;
}) {
	const { user } = useContext(UserContext);
	const { ugs, setUGS } = useContext(AllYourUGStatsContext);
	const { settings } = useContext(UserSettingsContext);

	const { data, error } = useApiQuery<UserGameStats[]>(
		// We should generate a valid url just in case the skip somehow fails
		`/users/${user?.id ?? "me"}/game-profiles`,
		undefined,
		undefined,
		// We should skip if a user isn't logged in.
		!user,
	);

	useEffect(() => {
		if (error) {
			console.error(error);
		}

		if (data) {
			setUGS(data);
		}
	}, [error, data]);

	return (
		<Nav as="nav" className="p-4 d-flex align-content-between gap-4 h-100">
			{user && ugs && ugs.length !== 0 && (
				<UserGameDropdown
					className={toggleClassNames}
					menuClassName={menuClassNames}
					setState={setState}
					style={dropdownMenuStyle}
					ugs={ugs}
					user={user}
				/>
			)}
			<GlobalInfoDropdown
				className={toggleClassNames}
				menuClassName={menuClassNames}
				setState={setState}
				style={dropdownMenuStyle}
			/>
			{user && (
				<ImportScoresDropdown
					className={toggleClassNames}
					menuClassName={menuClassNames}
					setState={setState}
					style={dropdownMenuStyle}
				/>
			)}
			{TachiConfig.QUEST_PROPOSALS_ENABLED && (
				<NavLink
					activeClassName="active"
					className="h-14 d-flex align-items-center fw-semibold px-2 rounded text-decoration-none focus-visible-ring nav-link"
					onClick={() => setState?.(false)}
					to="/quests"
				>
					Quest Editor
				</NavLink>
			)}
			{settings?.preferences.developerMode && (
				<NavLink
					activeClassName="active"
					className="h-14 d-flex align-items-center fw-semibold px-2 rounded text-decoration-none focus-visible-ring nav-link"
					onClick={() => setState?.(false)}
					to="/utils/imports"
				>
					Import Management
				</NavLink>
			)}
		</Nav>
	);
}
