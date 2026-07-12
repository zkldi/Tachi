import React, { useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";

import Icon from "./Icon";
import Muted from "./Muted";

export default function EditableText({
	as = "p",
	onSubmit,
	initialText,
	placeholderText,
	className,
	authorised,
}: {
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
	authorised: boolean;
	className?: string;
	initialText: string;
	onSubmit: (value: string) => void;
	placeholderText: string;
}) {
	const [text, setText] = useState(initialText);
	const [editing, setEditing] = useState(false);

	if (editing) {
		return (
			<InputGroup>
				<Form.Control
					onChange={(e) => setText(e.target.value)}
					placeholder={placeholderText}
					value={text}
				/>
				<Button
					onClick={() => {
						setEditing(false);
						onSubmit(text);
					}}
					type="submit"
					variant="success"
				>
					Change
				</Button>
			</InputGroup>
		);
	}

	return (
		<div
			className={`d-flex gap-2 ${authorised ? "cursor-pointer" : ""}`}
			onClick={() => authorised && setEditing(true)}
		>
			{React.createElement(as, { className }, text ? text : <Muted>{placeholderText}</Muted>)}
			{authorised && <Icon type="pencil-alt" />}
		</div>
	);
}
