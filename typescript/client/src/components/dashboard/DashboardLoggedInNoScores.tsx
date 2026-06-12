import Divider from "#components/util/Divider";
import LinkButton from "#components/util/LinkButton";
import { TachiConfig } from "#lib/config";
import { type UserDocument } from "tachi-common";

export function DashboardLoggedInNoScores({ user }: { user: UserDocument }) {
	return (
		<div>
			<span className="display-4">
				Welcome to {TachiConfig.NAME}, {user.username}!
			</span>
			<h4 className="mt-4">It looks like you have no scores. Let's get you set up!</h4>
			<Divider />
			<h4 style={{ lineHeight: 2 }}>
				Once you've got some scores imported, we'll analyse your scores.
				<br />
				You'll get a profile for that game, and a position on the leaderboards!
			</h4>
			<LinkButton to="/import" variant="outline-primary">
				Import some scores!
			</LinkButton>
		</div>
	);
}
