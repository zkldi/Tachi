import Navbar from "#components/nav/Navbar";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import FollowUserButton from "#components/util/FollowUserButton";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import { UserContext } from "#context/UserContext";
import { ClientConfig } from "#lib/config";
import { type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import { FormatDate } from "#util/time";
import React, { useContext, useState } from "react";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import { useQueryClient } from "react-query";
import { UserAuthLevels, type UserDocument } from "tachi-common";

import ProfileBadges from "./ProfileBadges";
import ProfilePicture from "./ProfilePicture";

export function UserHeaderBody({ reqUser }: { reqUser: UserDocument }) {
	function ConditionalSocialMediaRender({
		mode,
		href,
	}: {
		href?: string;
		mode: "discord" | "github" | "steam" | "twitch" | "twitter" | "youtube";
	}) {
		if (!reqUser.socialMedia[mode]) {
			return null;
		}

		return (
			<li>
				<Icon brand type={mode} />{" "}
				<ExternalLink
					className="text-decoration-none"
					href={href ? href + reqUser.socialMedia[mode] : undefined}
				>
					{reqUser.socialMedia[mode]}
				</ExternalLink>
			</li>
		);
	}

	const { user: loggedInUser } = useContext(UserContext);
	const queryClient = useQueryClient();

	async function invalidateProfileQueries() {
		await Promise.all([
			queryClient.invalidateQueries([`/users/${reqUser.username}`]),
			queryClient.invalidateQueries([`/users/${reqUser.id}`]),
		]);
	}

	return (
		<>
			<div className="col-12 col-lg-3">
				<div className="d-flex justify-content-center mb-3">
					<ProfilePicture key={reqUser.customPfpLocation ?? "default"} user={reqUser} />
				</div>
				<div className="d-flex align-items-center" style={{ flexDirection: "column" }}>
					<ProfileBadges user={reqUser} />
				</div>
				<div className="d-block d-lg-none">
					<Divider className="mt-4 mb-4" />
				</div>
			</div>
			<div className="col-12 col-lg-6 d-flex justify-content-center flex-column align-items-center">
				<StatusComponent reqUser={reqUser} />
				{loggedInUser?.authLevel === UserAuthLevels.ADMIN && (
					<>
						<Divider />
						<div className="d-flex flex-wrap gap-2 justify-content-center">
							{reqUser.isSupporter ? (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/supporter/${reqUser.id}`,
											{ method: "DELETE" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="danger"
								>
									Remove Supporter Rank?
								</Button>
							) : (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/supporter/${reqUser.id}`,
											{ method: "POST" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="primary"
								>
									Make Supporter?
								</Button>
							)}

							{reqUser.canSubmitQuests ? (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/quest-submitter/${reqUser.id}`,
											{ method: "DELETE" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="warning"
								>
									Revoke Quest Submitter?
								</Button>
							) : (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/quest-submitter/${reqUser.id}`,
											{ method: "POST" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="outline-success"
								>
									Grant Quest Submitter
								</Button>
							)}

							{reqUser.canImportProvidedClass !== false ? (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/import-provided-class/${reqUser.id}`,
											{ method: "DELETE" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="warning"
								>
									Ban Class Import?
								</Button>
							) : (
								<Button
									onClick={() =>
										APIFetchV1(
											`/admin/import-provided-class/${reqUser.id}`,
											{ method: "POST" },
											true,
											true,
										).then(async (res) => {
											if (res.success) {
												await invalidateProfileQueries();
											}
										})
									}
									variant="outline-success"
								>
									Unban Class Import
								</Button>
							)}
						</div>
					</>
				)}
			</div>
			<div className="col-12 col-lg-3 d-flex justify-content-center">
				<ul>
					<ConditionalSocialMediaRender mode="discord" />
					<ConditionalSocialMediaRender href="https://github.com/" mode="github" />
					<ConditionalSocialMediaRender
						href="https://steamcommunity.com/id/"
						mode="steam"
					/>
					<ConditionalSocialMediaRender href="https://twitch.tv/" mode="twitch" />
					<ConditionalSocialMediaRender href="https://twitter.com/" mode="twitter" />
					<ConditionalSocialMediaRender href="https://youtube.com/@" mode="youtube" />
					<li>
						<Muted>UserID: {reqUser.id}</Muted>
					</li>
					<li>
						<Muted>Joined: {FormatDate(reqUser.joinDate)}</Muted>
					</li>
				</ul>
			</div>
			{loggedInUser && reqUser.id !== loggedInUser.id && (
				<div className="col-12 mt-8">
					<Divider />
					<div className="d-flex w-100 justify-content-center ">
						<FollowUserButton userToFollow={reqUser} />
					</div>
				</div>
			)}
		</>
	);
}

export function UserBottomNav({ baseUrl, reqUser }: { baseUrl: string; reqUser: UserDocument }) {
	const { user } = useContext(UserContext);

	const isRequestedUser = !!(user && user.id === reqUser.id);

	const navItems = [
		<Navbar.Item key="about" to={`${baseUrl}/`}>
			Overview
		</Navbar.Item>,
		<Navbar.Item key="games" to={`${baseUrl}/games`}>
			Games
		</Navbar.Item>,
	];

	if (isRequestedUser) {
		navItems.push(
			<Navbar.Item key="integrations" to={`${baseUrl}/integrations`}>
				Service Integrations
			</Navbar.Item>,
		);
		navItems.push(
			<Navbar.Item key="imports" to={`${baseUrl}/imports`}>
				Imports
			</Navbar.Item>,
		);
		navItems.push(
			<Navbar.Item key="orphans" to={`${baseUrl}/orphans`}>
				Orphans
			</Navbar.Item>,
		);

		// If mandates login, assume that we also use invite codes.
		// I'm sure we could set up an elaborate way of doing this by
		// querying the server, but I just don't care.
		if (ClientConfig.MANDATE_LOGIN) {
			navItems.push(
				<Navbar.Item key="invites" to={`${baseUrl}/invites`}>
					Invites
				</Navbar.Item>,
			);
		}

		navItems.push(
			<Navbar.Item key="settings" to={`${baseUrl}/settings`}>
				Profile Settings
			</Navbar.Item>,
		);
	}

	return <Navbar>{navItems}</Navbar>;
}

function StatusComponent({ reqUser }: { reqUser: UserDocument }) {
	const { user } = useContext(UserContext);

	const isRequestedUser = user?.id === reqUser.id;

	const [modalShow, setModalShow] = useState(false);

	return (
		<div className="row text-center">
			<div className="col-12">
				{reqUser.status ? (
					<span>{reqUser.status}</span>
				) : (
					<Muted>
						{isRequestedUser ? "You have" : `${reqUser.username} has`} no status...
					</Muted>
				)}
			</div>
			<div className="col-12">
				{isRequestedUser && (
					<a
						className="link-opacity-75 link-opacity-100-hover text-decoration-none transition-color"
						href="#"
						onClick={() => setModalShow(true)}
					>
						Change Status
					</a>
				)}
			</div>
			{/* <div className="col-12">
				<Muted>Last Seen: {MillisToSince(reqUser.lastSeen)}</Muted>
			</div> */}
			<ChangeStatusModal
				modalShow={modalShow}
				reqUser={reqUser}
				setModalShow={setModalShow}
			/>
		</div>
	);
}

function ChangeStatusModal({
	modalShow,
	setModalShow,
	reqUser,
}: {
	modalShow: boolean;
	reqUser: UserDocument;
	setModalShow: SetState<boolean>;
}) {
	const [status, setStatus] = useState(reqUser.status);
	const [innerStatus, setInnerStatus] = useState(reqUser.status ?? "");

	return (
		<Modal onHide={() => setModalShow(false)} show={modalShow}>
			<Modal.Header closeButton>
				<Modal.Title>Change Status</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Form
					onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
						e.preventDefault();

						APIFetchV1(
							"/users/me",
							{
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									status: innerStatus || null,
								}),
							},
							true,
							true,
						).then((r) => {
							if (r.success) {
								setStatus(innerStatus);
								reqUser.status = innerStatus;
								setModalShow(false);
							}
						});
					}}
				>
					<Form.Group>
						<InputGroup size="lg">
							<Form.Control
								onChange={(e) => setInnerStatus(e.target.value)}
								placeholder={status ?? "I'm gaming..."}
								type="text"
								value={innerStatus}
							/>
							<Button type="submit" variant="primary">
								Submit
							</Button>
						</InputGroup>
					</Form.Group>
				</Form>
			</Modal.Body>
		</Modal>
	);
}
