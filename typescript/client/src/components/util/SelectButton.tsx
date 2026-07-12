import { type JustChildren, type SetState } from "#types/react";
import React, { type CSSProperties } from "react";
import { Button } from "react-bootstrap";
import { type ButtonVariant } from "react-bootstrap/esm/types";

export default function SelectButton<T>({
	id,
	value,
	setValue,
	children,
	onVariant = "primary",
	offVariant = "outline-secondary",
	disabled = false,
	onStyle = {},
	offStyle = {},
	style = {},
	className = "",
}: {
	className?: string;
	disabled?: boolean;
	id: T;
	offStyle?: CSSProperties;
	offVariant?: ButtonVariant;
	onStyle?: CSSProperties;
	onVariant?: ButtonVariant;
	setValue: SetState<T>;
	style?: CSSProperties;
	value: T;
} & JustChildren) {
	const active = id === value;
	return (
		<Button
			className={`${
				active ? "" : "text-body text-light-hover text-light-focus"
			} ${className}`}
			disabled={disabled}
			onClick={() => setValue(id)}
			style={active ? Object.assign(style, onStyle) : Object.assign(style, offStyle)}
			variant={active ? onVariant : offVariant}
		>
			{children}
		</Button>
	);
}
