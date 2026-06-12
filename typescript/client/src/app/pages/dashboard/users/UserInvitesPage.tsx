import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import { APIFetchV1 } from "#util/api";
import { CopyToClipboard } from "#util/misc";
import { FormatTime } from "#util/time";
import { Button, Col, Row } from "react-bootstrap";
import { useQueryClient } from "react-query";
import { Link } from "react-router-dom";
import {
	type integer,
	type InviteCodeDocument,
	UserAuthLevels,
	type UserDocument,
} from "tachi-common";

export default function UserInvitesPage({ reqUser }: { reqUser: UserDocument }) {
	useSetSubheader(
		["Users", reqUser.username, "Invites"],
		[reqUser],
		`${reqUser.username}'s Invites`,
	);

	const queryClient = useQueryClient();

	const { data, error } = useApiQuery<{ invites: integer; limit: integer }>(
		`/users/${reqUser.id}/invites/limit`,
	);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const newInvites = data.limit - data.invites;

	return (
		<Card className="col-12 offset-lg-2 col-lg-8" header="Invites">
			<Row>
				<Col className="text-center" xs={12}>
					<h4 className="display-4">
						You can make <b>{newInvites}</b> invite code{newInvites !== 1 ? "s" : ""}.
					</h4>
					<h4>You get new invite codes every month.</h4>
					<span className="text-danger">
						By inviting a user, you take partial responsibility for their actions. If
						they cause trouble, you may also be in trouble.
						<br />
						Only invite people you trust!
					</span>
					<Divider />
				</Col>
				{(newInvites !== 0 || reqUser.authLevel === UserAuthLevels.ADMIN) && (
					<Col xs={12}>
						<div className="d-flex justify-content-center">
							<Button
								className="btn btn-primary"
								onClick={async () => {
									const r = await APIFetchV1(
										`/users/${reqUser.id}/invites/create`,
										{
											method: "POST",
										},
										true,
										true,
									);

									if (r.success) {
										await Promise.all([
											queryClient.invalidateQueries([
												`/users/${reqUser.id}/invites`,
											]),
											queryClient.invalidateQueries([
												`/users/${reqUser.id}/invites/limit`,
											]),
										]);
									}
								}}
							>
								Create new Invite
							</Button>
						</div>
						<Divider />
					</Col>
				)}
				<Col xs={12}>
					<h4 className="text-center mb-4">Your Invites</h4>
					<InviteList reqUser={reqUser} />
				</Col>
			</Row>
		</Card>
	);
}

function InviteList({ reqUser }: { reqUser: UserDocument }) {
	const { data, error } = useApiQuery<{
		consumers: UserDocument[];
		invites: InviteCodeDocument[];
	}>(`/users/${reqUser.id}/invites`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	const unconsumed = data.invites.filter((e) => !e.consumed);
	const consumed = data.invites.filter((e) => e.consumed);

	return (
		<div style={{ fontSize: "1.2rem" }}>
			<h3>Unused</h3>
			<Muted>
				These codes have not been used by anyone yet! You can send them to anyone to let
				them onto the site.
			</Muted>
			{unconsumed.length ? (
				unconsumed.map((e) => (
					<div key={e.code}>
						<code>{e.code}</code>{" "}
						<Icon
							onClick={() => {
								const params = new URLSearchParams({ inviteCode: e.code });

								CopyToClipboard(
									`${window.location.origin}/register?${params.toString()}`,
								);
							}}
							type="link"
						/>
					</div>
				))
			) : (
				<div>No Unconsumed Invites!</div>
			)}
			<h3 className="mt-4">Users you have Invited</h3>
			<div style={{ fontSize: "1.1rem" }}>
				{consumed.length ? (
					consumed.map((e) => (
						<div key={e.code}>
							Invited{" "}
							<Link to={`/u/${e.consumedBy}`}>
								{data.consumers.find((u) => u.id === e.consumedBy)?.username ??
									"Unknown"}
							</Link>{" "}
							at {FormatTime(e.consumedAt || 0)}
						</div>
					))
				) : (
					<div>No-one, yet!</div>
				)}
			</div>
		</div>
	);
}
