import ProfilePicture from "#components/user/ProfilePicture";
import { type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import React, { useEffect, useState } from "react";
import { Button, Col, Modal, Row } from "react-bootstrap";
import { type integer, type UserDocument } from "tachi-common";

import DebounceSearch from "../DebounceSearch";
import Divider from "../Divider";

export default function UserSelectModal({
	callback,
	show,
	setShow,
	url = `/users`,
	excludeSet = [],
	excludeMsg = "N/A",
}: {
	callback: (user: UserDocument) => void;
	excludeMsg?: string;
	excludeSet?: Array<integer>;
	setShow: SetState<boolean>;
	show: boolean;
	url?: string;
}) {
	const [search, setSearch] = useState("");
	const [users, setUsers] = useState<Array<UserDocument> | null>(null);
	const [errMsg, setErrMsg] = useState<string | null>(null);

	useEffect(() => {
		if (!search) {
			return;
		}

		const searchParams = new URLSearchParams();
		searchParams.set("search", search);

		APIFetchV1<UserDocument[]>(`${url}?${searchParams.toString()}`).then((res) => {
			if (res.success) {
				setErrMsg(null);

				setUsers(res.body);
			} else {
				setErrMsg(res.description);
			}
		});
	}, [search]);

	return (
		<Modal onHide={() => setShow(false)} show={show} size="xl">
			<Modal.Header closeButton>
				<Modal.Title>Search Users</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Row>
					<Col xs={12}>
						<DebounceSearch placeholder="Search users..." setSearch={setSearch} />
						<Divider />
						<span className="text-danger">{errMsg}</span>
						<div className="d-flex justify-content-center flex-wrap">
							{users &&
								users.map((user) => (
									<div className="text-center p-8" key={user.id}>
										<ProfilePicture user={user} />
										<h4 className="mt-2">{user.username}</h4>
										{excludeSet.includes(user.id) ? (
											<Button disabled variant="outline-secondary">
												{excludeMsg}
											</Button>
										) : (
											<Button
												onClick={() => callback(user)}
												variant="outline-success"
											>
												Select
											</Button>
										)}
									</div>
								))}
						</div>
					</Col>
				</Row>
			</Modal.Body>
		</Modal>
	);
}
