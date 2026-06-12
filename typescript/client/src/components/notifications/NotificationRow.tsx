import TimestampCell from "#components/tables/cells/TimestampCell";
import Icon from "#components/util/Icon";
import { Link } from "react-router-dom";
import { type NotificationDocument } from "tachi-common";

export default function NotificationRow({ notif }: { notif: NotificationDocument }) {
	const url = NotifToURL(notif);

	return (
		<tr>
			<td>
				{notif.read ? (
					<Icon colour="body-secondary" regular type="envelope" />
				) : (
					<Icon type="envelope-open" />
				)}
			</td>
			<td>
				<strong>
					{url ? (
						<Link className="text-decoration-none" to={url}>
							{notif.title}
						</Link>
					) : (
						notif.title
					)}
				</strong>
			</td>
			<TimestampCell time={notif.sentAt} />
		</tr>
	);
}

function NotifToURL(notif: NotificationDocument) {
	switch (notif.body.type) {
		case "QUEST_CHANGED": {
			const { game, questID } = notif.body.content;

			return `/games/${game}/quests/${questID}`;
		}
		case "RIVALED_BY":
			return `/u/${notif.body.content.userID}/games/${notif.body.content.game}`;
		case "SITE_ANNOUNCEMENT":
			return null;
		case "ORPHANS_RESTORED":
			return `/u/${notif.sentTo}/orphans`;
	}
}
