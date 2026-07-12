import QuickTooltip from "#components/layout/misc/QuickTooltip";
import Icon from "#components/util/Icon";
import { UserContext } from "#context/UserContext";
import { type SetState } from "#types/react";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import { type ScoreDocument } from "tachi-common";

export default function ScoreEditButtons({
	score,
	scoreState,
	onScoreUpdate,
}: {
	onScoreUpdate?: (sc: ScoreDocument) => void;
	score: ScoreDocument;
	scoreState: {
		comment: string | null;
		highlight: boolean;
		setComment: SetState<string | null>;
		setHighlight: SetState<boolean>;
	};
}) {
	const { user } = useContext(UserContext);

	const { highlight, setHighlight, comment, setComment } = scoreState;

	const [show, setShow] = useState(false);

	return (
		<div className="mt-4 d-flex w-100 justify-content-center">
			<div className="btn-group">
				{user?.id === score.userID && (
					<>
						{comment ? (
							<>
								<QuickTooltip tooltipContent="Edit your comment on this score.">
									<Button
										className="text-body"
										onClick={() => setShow(true)}
										variant="outline-secondary text-light-hover"
									>
										<Icon type="file-signature" /> Edit Comment
									</Button>
								</QuickTooltip>
							</>
						) : (
							<QuickTooltip tooltipContent="Comment on this score.">
								<Button
									className="text-body"
									onClick={() => setShow(true)}
									variant="outline-secondary text-light-hover"
								>
									<Icon type="file-signature" /> Comment
								</Button>
							</QuickTooltip>
						)}

						{highlight ? (
							<QuickTooltip tooltipContent="Unhighlight this score.">
								<Button
									onClick={() =>
										ModifyScore(score.scoreID, { highlight: false }).then(
											(r) => {
												if (r) {
													setHighlight(false);
													score.highlight = false;
													onScoreUpdate?.(score);
												}
											},
										)
									}
									variant="outline-danger"
								>
									<Icon type="star" /> Un-Highlight
								</Button>
							</QuickTooltip>
						) : (
							<QuickTooltip tooltipContent="Highlight this score.">
								<Button
									className="text-body text-light-hover"
									onClick={() =>
										ModifyScore(score.scoreID, { highlight: true }).then(
											(r) => {
												if (r) {
													setHighlight(true);
													score.highlight = true;
													onScoreUpdate?.(score);
												}
											},
										)
									}
									variant="outline-secondary"
								>
									<Icon type="star" /> Highlight
								</Button>
							</QuickTooltip>
						)}
					</>
				)}
			</div>
			<CommentModal
				initialComment={comment}
				onUpdate={(comment) => {
					ModifyScore(score.scoreID, { comment }).then((r) => {
						if (r) {
							setComment(comment);
							score.comment = comment;
							setShow(false);
							onScoreUpdate?.(score);
						}
					});
				}}
				setShow={setShow}
				show={show}
			/>
		</div>
	);
}

export async function ModifyScore(
	scoreID: string,
	content: { comment?: string | null; highlight?: boolean },
) {
	const res = await APIFetchV1(
		`/scores/${scoreID}`,
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(content),
		},
		true,
		true,
	);

	return res.success;
}

export function CommentModal({
	show,
	setShow,
	initialComment,
	onUpdate,
}: {
	initialComment: string | null;
	onUpdate: (newComment: string | null) => void;
	setShow: SetState<boolean>;
	show: boolean;
}) {
	const [innerComment, setInnerComment] = useState(initialComment ?? "");

	const ref = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (show && ref.current) {
			ref.current.focus();
		}
	}, [show]);

	return (
		<Modal onHide={() => setShow(false)} show={show}>
			<Modal.Header closeButton>
				<Modal.Title>Edit Comment</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<Form
					onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
						e.preventDefault();

						if (innerComment === "") {
							onUpdate(null);
						} else {
							onUpdate(innerComment);
						}
					}}
				>
					<Form.Group>
						<InputGroup size="lg">
							<Form.Control
								autoFocus
								onChange={(e) => setInnerComment(e.target.value)}
								placeholder={initialComment ?? "This score was great!"}
								ref={ref}
								type="text"
								value={innerComment}
							/>

							<Button type="submit" variant="primary">
								Submit
							</Button>
						</InputGroup>
					</Form.Group>

					{initialComment !== null && (
						<QuickTooltip tooltipContent="Remove your comment on this score.">
							<Button
								onClick={() => {
									onUpdate(null);

									setInnerComment("");
								}}
								variant="outline-danger"
							>
								<Icon noPad type="trash" />
							</Button>
						</QuickTooltip>
					)}
				</Form>
			</Modal.Body>
		</Modal>
	);
}
