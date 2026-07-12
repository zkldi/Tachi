import ProfilePicture from "#components/user/ProfilePicture";
import { type GameProps, type JustChildren } from "#types/react";
import { Link } from "react-router-dom";
import { type UserDocument } from "tachi-common";

export default function UserIcon({
	user,
	children,
	game,
}: { user: UserDocument } & Partial<GameProps> & Partial<JustChildren>) {
	return (
		<div className="text-center p-8">
			<ProfilePicture toGame={game ? { game } : undefined} user={user} />
			<h4 className="mt-2">
				<Link to={game ? `/u/${user.username}/games/${game}` : `/u/${user.username}`}>
					{user.username}
				</Link>
			</h4>
			{children && <div className="d-flex justify-content-center">{children}</div>}
		</div>
	);
}
