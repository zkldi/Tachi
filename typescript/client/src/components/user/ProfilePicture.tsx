import { type GameProps } from "#types/react";
import { ToAPIURL } from "#util/api";
import { Link } from "react-router-dom";
import { type UserDocument } from "tachi-common";

export default function ProfilePicture({
	user,
	src,
	toGame,
	link = true,
	size = "lg",
}: {
	/**
	 * Whether or not this profile picture should be a link (default = true)
	 */
	link?: boolean;

	/**
	 * sm = 32px, lg = 128px
	 */
	size?: "lg" | "sm";

	/**
	 * Specify an image src instead of infering one from the user's info
	 */
	src?: string;

	/**
	 * When clicking this this profile, should it take you to a UserGame page?
	 */
	toGame?: GameProps;

	user: UserDocument;
}) {
	const dimensions = size === "sm" ? 32 : 128;
	const props = {
		src: src ? src : ToAPIURL(`/users/${user.id}/pfp`),
		alt: `${user.username}'s Profile Picture`,
		height: dimensions,
		width: dimensions,
		className: "d-inline-block object-fit-cover bg-body-tertiary shadow-sm rounded fs-0",
	};

	// this API is bad an hard to use. Why is it like this?

	if (link) {
		let addendum = "";
		if (toGame) {
			addendum = `/games/${toGame.game}`;
		}

		return (
			<Link to={`/u/${user.username}${addendum}`}>
				<img {...props} />
			</Link>
		);
	}
	return <img {...props} />;
}
