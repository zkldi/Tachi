import SupporterIcon from "#components/util/SupporterIcon";
import { type GameProps } from "#types/react";
import { ToAPIURL } from "#util/api";
import { Link } from "react-router-dom";
import { type UserDocument } from "tachi-common";

export default function UserCell({
	user,
	game,
	showProfilePicture = true,
}: { showProfilePicture?: boolean; user: UserDocument } & GameProps) {
	return (
		<td
			className="fading-image-td-right"
			style={{
				backgroundRepeat: "no-repeat",
				backgroundSize: "cover",
				backgroundPosition: "center",
				["--image-url" as string]: showProfilePicture
					? `url(${ToAPIURL(`/users/${user.id}/pfp`)})`
					: undefined,
			}}
		>
			<Link className="text-decoration-none" to={`/u/${user.username}/games/${game}`}>
				{user.username}
				{user.isSupporter && (
					<>
						{" "}
						<SupporterIcon />
					</>
				)}
			</Link>
		</td>
	);
}
