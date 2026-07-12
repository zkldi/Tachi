import { type JustChildren } from "#types/react";
import { APIFetchV1 } from "#util/api";
import React, { createContext, useContext, useEffect, useState } from "react";
import { type NotificationDocument } from "tachi-common";

import { UserContext } from "./UserContext";

export const NotificationsContext = createContext<{
	notifications: Array<NotificationDocument>;
	reload: () => Promise<void>;
}>({
	notifications: [],
	// eslint-disable-next-line require-await
	reload: async () => void 0,
});

export function NotificationsContextProvider({ children }: JustChildren) {
	const { user } = useContext(UserContext);

	const [notifications, setNotifications] = useState<Array<NotificationDocument>>([]);

	const reload = async () => {
		if (!user) {
			setNotifications([]);
			return;
		}

		await APIFetchV1<Array<NotificationDocument>>(`/users/${user.id}/notifications`).then(
			(r) => {
				if (!r.success) {
					setNotifications([]);
					return;
				}

				setNotifications(r.body);
			},
		);
	};

	// fetch the target subscriptions from the api.
	useEffect(() => {
		reload();
	}, [user]);

	return (
		<NotificationsContext.Provider value={{ notifications, reload }}>
			{children}
		</NotificationsContext.Provider>
	);
}
