import useSetSubheader from "#components/layout/header/useSetSubheader";
import UserGameProfiles from "#components/user/UserGameProfiles";
import { type UserDocument } from "tachi-common";

export default function UserGamesPage({ reqUser }: { reqUser: UserDocument }) {
	useSetSubheader(
		["Users", reqUser.username, "Games"],
		[reqUser],
		`${reqUser.username}'s Game Profiles`,
	);

	return <UserGameProfiles reqUser={reqUser} />;
}
