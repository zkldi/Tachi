import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";
import { NotificationsContext } from "#context/NotificationsContext";
import { useContext, useMemo } from "react";
import { Badge } from "react-bootstrap";

export function UserNotificationButton() {
	const { notifications } = useContext(NotificationsContext);

	const unread = useMemo(() => {
		if (!notifications) {
			return 0;
		}

		return notifications.filter((e) => e.read === false).length;
	}, [notifications]);

	return (
		<LinkButton
			aria-label="Notifications"
			className="h-14 w-14 px-4 d-flex align-items-center position-relative display-6 text-body-secondary"
			to="/notifications"
			variant="clear"
		>
			{unread > 0 ? (
				<>
					<Icon colour="primary" type="envelope" />
					<Badge
						bg="secondary-subtle"
						className="position-absolute text-primary"
						pill
						style={{ scale: "0.75", top: "6%", left: "52%" }}
					>
						{unread <= 9 ? unread : "9+"}
					</Badge>
				</>
			) : (
				<>
					<Icon regular type="envelope" />
				</>
			)}
		</LinkButton>
	);
}
