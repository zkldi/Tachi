import Activity from "#components/activity/Activity";
import { AllYourUGStatsContext } from "#context/AllYourUGStatsContext";
import { useContext } from "react";
import { type UserDocument } from "tachi-common";

import { DashboardLoggedInNoScores } from "./DashboardLoggedInNoScores";

export default function DashboardActivity({ user }: { user: UserDocument }) {
	const { ugs } = useContext(AllYourUGStatsContext);

	if (ugs?.length === 0) {
		return <DashboardLoggedInNoScores user={user} />;
	}

	return (
		<>
			<div className="display-4 mb-4">Here's what's been happening.</div>
			<Activity url={`/users/${user.id}/activity?includeRivals=true&includeFollowers=true`} />
		</>
	);
}
