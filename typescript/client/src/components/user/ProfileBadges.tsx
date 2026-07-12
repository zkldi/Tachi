import { Badge } from "react-bootstrap";
import { type UserBadges, type UserDocument } from "tachi-common";

export default function ProfileBadges({ user }: { user: UserDocument }) {
	return (
		<>
			{user.badges.map((e, i) => (
				<span className="mt-1" key={i}>
					<ProfileBadge bg={e} />
				</span>
			))}
			{user.isSupporter && (
				<span className="mt-1">
					<Badge bg="warning" className="text-dark">
						Supporter!
					</Badge>
				</span>
			)}
		</>
	);
}

export function ProfileBadge({ bg }: { bg: UserBadges }) {
	if (bg === "alpha") {
		return (
			<Badge bg="warning" className="text-dark">
				Alpha Tester
			</Badge>
		);
	} else if (bg === "beta") {
		return (
			<Badge bg="info" className="text-light">
				Beta Tester
			</Badge>
		);
	} else if (bg === "dev-team") {
		return (
			<Badge bg="primary" className="text-light">
				Dev Team
			</Badge>
		);
	} else if (bg === "contributor") {
		// discord contributor colour
		return (
			<Badge className="text-light" style={{ backgroundColor: "#1abc9c" }}>
				Contributor
			</Badge>
		);
	} else if (bg === "significant-contributor") {
		// discord sig. contributor colour
		return <Badge style={{ backgroundColor: "#e62e22" }}>Significant Contributor</Badge>;
	}
	return <></>;
}
