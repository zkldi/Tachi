import ProfilePicture from "#components/user/ProfilePicture";
import LinkButton from "#components/util/LinkButton";
import { type UserDocument } from "tachi-common/types/documents";

import { SearchButton } from "./SearchButton";
import { UserNotificationButton } from "./UserNotificationButton";
import { UserProfileDropdown } from "./UserProfileDropdown";

export default function UserArea({
	user,
	dropdownMenuStyle,
}: {
	dropdownMenuStyle?: React.CSSProperties;
	user: UserDocument | null;
}) {
	return (
		<div className="d-flex align-items-center gap-2">
			<SearchButton />
			{!user || user === null ? (
				<>
					<LinkButton className="me-2" to="/login" variant="outline-primary">
						Log In
					</LinkButton>
					<LinkButton to="/register">Create Account</LinkButton>
				</>
			) : (
				<>
					<UserNotificationButton />
					<UserProfileDropdown style={dropdownMenuStyle} user={user} />
					<div className="h-14 w-14 d-flex d-lg-none justify-content-center align-items-center">
						<ProfilePicture size="sm" user={user} />
					</div>
				</>
			)}
		</div>
	);
}
