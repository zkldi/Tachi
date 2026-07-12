import Activity from "#components/activity/Activity";
import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import Divider from "#components/util/Divider";
import ExternalLink from "#components/util/ExternalLink";
import Muted from "#components/util/Muted";
import { UserContext } from "#context/UserContext";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import { type UserDocument } from "tachi-common";

interface Props {
	reqUser: UserDocument;
}

export default function UserPage({ reqUser }: Props) {
	useSetSubheader(["Users", reqUser.username], [reqUser], `${reqUser.username}'s Profile`);

	return (
		<>
			<AboutMeCard reqUser={reqUser} />

			<Divider />
			<Activity url={`/users/${reqUser.id}/activity`} />
		</>
	);
}

function InferLinks(aboutMe: string) {
	return aboutMe.replace(/[^(](https?:\/\/[a-zA-Z0-9-._~?&=]+)(\s*)/gu, "[$1]($1)$2");
}

function AboutMeCard({ reqUser }: Props) {
	const { user } = useContext(UserContext);

	const [editMode, setEditMode] = useState(false);
	const [content, setContent] = useState(reqUser.about);

	useEffect(() => setContent(reqUser.about), [reqUser]);

	async function SubmitNewAboutMe() {
		const res = await APIFetchV1(
			`/users/${user!.id}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ about: content }),
			},
			true,
			true,
		);

		if (res.success) {
			setEditMode(false);
		}
	}

	useEffect(() => {
		if (
			editMode &&
			(content === "<script>alert(1)</script>" || content === "<script>alert(1);</script>")
		) {
			alert(`1\n\n\n...Just kidding, this is an easter egg :)`);
		}
	}, [content]);

	let footer = <></>;

	if (user?.id === reqUser.id) {
		if (!editMode) {
			footer = (
				<div className="d-flex justify-content-end">
					<Button onClick={() => setEditMode(true)} variant="info">
						Edit
					</Button>
				</div>
			);
		} else {
			footer = (
				<div className="d-flex">
					<Button
						className="me-auto"
						onClick={() => {
							setEditMode(false);
							setContent(reqUser.about);
						}}
						variant="secondary"
					>
						Cancel
					</Button>
					<Button
						className="ms-auto"
						onClick={() => SubmitNewAboutMe()}
						variant="success"
					>
						Submit
					</Button>
				</div>
			);
		}
	}

	return (
		<Card footer={footer} header="About Me">
			{editMode && (
				<>
					<textarea
						className="w-100"
						onChange={(e) => setContent(e.target.value)}
						style={{ height: 200 }}
						value={content}
					/>
					<Muted>
						You can use{" "}
						<ExternalLink href="https://www.markdownguide.org/basic-syntax/">
							markdown
						</ExternalLink>{" "}
						here!
					</Muted>
					{content.length > 1900 && (
						<>
							<br />
							<span
								className={content.length >= 2000 ? "text-danger" : "text-warning"}
							>
								{content.length}/2000
							</span>
						</>
					)}
					<Divider className="mt-4 mb-4" />
				</>
			)}
			<ReactMarkdown>{InferLinks(content)}</ReactMarkdown>
		</Card>
	);
}
