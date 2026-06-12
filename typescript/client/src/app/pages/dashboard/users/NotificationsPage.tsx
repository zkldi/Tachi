import ErrorPage from "#app/pages/ErrorPage";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import NotificationRow from "#components/notifications/NotificationRow";
import MiniTable from "#components/tables/components/MiniTable";
import Loading from "#components/util/Loading";
import { NotificationsContext } from "#context/NotificationsContext";
import { UserContext } from "#context/UserContext";
import { APIFetchV1 } from "#util/api";
import { useContext, useEffect, useMemo } from "react";
import { Button, Col, Row } from "react-bootstrap";
import { type UserDocument } from "tachi-common";

export default function NotificationsPage() {
	const { user } = useContext(UserContext);

	useSetSubheader(["Dashboard", "Notifications"]);

	if (!user) {
		return <ErrorPage statusCode={401} />;
	}

	return <NotificationsInnerPage user={user} />;
}

function NotificationsInnerPage({ user }: { user: UserDocument }) {
	const { notifications, reload } = useContext(NotificationsContext);

	const unread = useMemo(() => {
		if (!notifications) {
			return 0;
		}

		return notifications.filter((e) => e.read === false).length;
	}, [notifications]);

	// mark all notifications the user has seen as being read, this runs on mount
	// and never again
	useEffect(() => {
		if (notifications) {
			APIFetchV1(`/users/${user.id}/notifications/mark-all-read`, { method: "POST" }).then(
				() => reload(),
			);
		}
		// deliberate
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (!notifications) {
		return <Loading />;
	}

	if (notifications.length === 0) {
		return (
			<div className="d-flex w-100 justify-content-center">
				<div>You've got no mail!</div>
			</div>
		);
	}

	return (
		<Row>
			<Col xs={12}>
				<MiniTable headers={["Read"]}>
					{notifications.map((e) => (
						<NotificationRow key={e.notifID} notif={e} />
					))}
				</MiniTable>
			</Col>
			<Col xs={12}>
				<div className="w-100 d-flex">
					<div style={{ flex: 1 }}></div>
					<div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
						<Button
							onClick={async () => {
								await APIFetchV1(`/users/${user.id}/notifications/delete-all`, {
									method: "POST",
								});

								reload();
							}}
							variant="outline-danger"
						>
							Clear Notifications
						</Button>
					</div>
					<div style={{ flex: 1, textAlign: "right" }}>
						{notifications.length} Notifications.
						{unread > 0 && (
							<>
								{" "}
								<strong>({unread} Unread)</strong>
							</>
						)}
					</div>
				</div>
			</Col>
		</Row>
	);
}
