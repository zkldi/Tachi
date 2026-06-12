import useLoggedInUserGameSettings from "#components/util/useLoggedInUserGameSettings";
import { type UserGameTargetSubs } from "#types/api-returns";
import { type JustChildren } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { createContext, useEffect, useState } from "react";
import { type GoalSubscriptionDocument, type QuestSubscriptionDocument } from "tachi-common";

export const TargetsContext = createContext<{
	goalSubs: Map<string, GoalSubscriptionDocument>;
	questSubs: Map<string, QuestSubscriptionDocument>;
	reloadTargets: () => Promise<void>;
}>({
	questSubs: new Map(),
	goalSubs: new Map(),
	// eslint-disable-next-line require-await
	reloadTargets: async () => void 0,
});

export function TargetsContextProvider({ children }: JustChildren) {
	const { settings } = useLoggedInUserGameSettings();

	const [questSubs, setQuestSubs] = useState<Map<string, QuestSubscriptionDocument>>(new Map());
	const [goalSubs, setGoalSubs] = useState<Map<string, GoalSubscriptionDocument>>(new Map());

	const reloadTargets = async () => {
		if (!settings) {
			setQuestSubs(new Map());
			setGoalSubs(new Map());
			return;
		}

		await APIFetchV1<UserGameTargetSubs>(
			`/users/${settings.userID}/games/${settings.game}/targets/all-subs`,
		).then((r) => {
			if (!r.success) {
				setQuestSubs(new Map());
				setGoalSubs(new Map());
				return;
			}

			const questSubMap = new Map<string, QuestSubscriptionDocument>();
			const goalSubMap = new Map<string, GoalSubscriptionDocument>();

			for (const qSub of r.body.questSubs) {
				questSubMap.set(qSub.questID, qSub);
			}
			for (const gSub of r.body.goalSubs) {
				goalSubMap.set(gSub.goalID, gSub);
			}

			setQuestSubs(questSubMap);
			setGoalSubs(goalSubMap);
		});
	};

	// fetch the target subscriptions from the api.
	useEffect(() => {
		reloadTargets();
	}, [settings]);

	return (
		<TargetsContext.Provider value={{ goalSubs, questSubs, reloadTargets }}>
			{children}
		</TargetsContext.Provider>
	);
}
