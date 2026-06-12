import DropdownNavLink from "#components/ui/DropdownNavLink";
import QuickDropdown from "#components/ui/QuickDropdown";
import ProfilePicture from "#components/user/ProfilePicture";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import SignOut from "#components/util/SignOut";
import SupporterIcon from "#components/util/SupporterIcon";
import { type TextColour } from "#types/bootstrap";
import { RFA } from "#util/misc";
import { heySplashes } from "#util/splashes";
import { useState } from "react";
import { UserAuthLevels, type UserDocument } from "tachi-common";

function UserProfileDropdownToggle({ user }: { user: UserDocument }) {
	const [heySplash] = useState(RFA(heySplashes));
	return (
		<>
			<div className="me-3 d-none d-lg-block">
				<span className="text-body-secondary">{heySplash}, </span>
				{user.username}
				{user.isSupporter && (
					<>
						{" "}
						<SupporterIcon />
					</>
				)}
			</div>
			<ProfilePicture link={false} size="sm" user={user} />
		</>
	);
}

function UserProfileMenuItem({
	to,
	id,
	iconType,
	iconColour,
	children,
}: {
	children: React.ReactNode;
	iconColour: TextColour;
	iconType: string;
	id: string;
	to: string;
}) {
	return (
		<DropdownNavLink
			className="d-flex align-items-center gap-6 p-4 text-wrap"
			id={id}
			isActive={() => false}
			style={{ minWidth: "30rem" }}
			to={to}
		>
			<span className="display-6">
				<Icon colour={iconColour} type={iconType} />
			</span>
			<div>{children}</div>
		</DropdownNavLink>
	);
}

export function UserProfileDropdown({
	user,
	style,
}: {
	style?: React.CSSProperties;
	user: UserDocument;
}) {
	return (
		<QuickDropdown
			align="end"
			dropdownClassName="d-none d-lg-block"
			id="user-profile-dropdown"
			menuClassName="p-4"
			menuStyle={style}
			toggle={<UserProfileDropdownToggle user={user} />}
			variant="clear"
		>
			<div className="d-flex flex-column gap-2">
				<UserProfileMenuItem
					iconColour="primary"
					iconType="user"
					id="my-profile"
					to={`/u/${user.username}`}
				>
					<div className="fw-semibold text-body">My Profile</div>
					<div className="text-body-secondary">View your profile!</div>
				</UserProfileMenuItem>
				<UserProfileMenuItem
					iconColour="info"
					iconType="cog"
					id="profile-settings"
					to={`/u/${user.username}/settings`}
				>
					<div className="fw-semibold text-body">Profile Settings</div>
					<div className="text-body-secondary">
						Manage your profile picture, status, and more!
					</div>
				</UserProfileMenuItem>
				<UserProfileMenuItem
					iconColour="danger"
					iconType="wrench"
					id="my-integrations"
					to={`/u/${user.username}/integrations`}
				>
					<div className="fw-semibold text-body">My Integrations</div>
					<div className="text-body-secondary">
						Manage your API Keys and integrations with other services.
					</div>
				</UserProfileMenuItem>

				{user.authLevel === UserAuthLevels.ADMIN && (
					<UserProfileMenuItem
						iconColour="warning"
						iconType="user-shield"
						id="admin-panel"
						to="/admin"
					>
						<div className="fw-semibold text-body">Admin Panel</div>
						<div className="text-body-secondary">Site administration tools.</div>
					</UserProfileMenuItem>
				)}

				<Divider className="my-2" />
				<SignOut className="align-self-end mb-2 mt-2" />
			</div>
		</QuickDropdown>
	);
}
