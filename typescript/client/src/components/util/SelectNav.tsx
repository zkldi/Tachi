import { type JustChildren, type SetState } from "#types/react";
import { Nav } from "react-bootstrap";

export default function SelectNav<T>({
	id,
	value,
	setValue,
	children,
	disabled = false,
}: {
	disabled?: boolean;
	id: T;
	setValue: SetState<T>;
	value: T;
} & JustChildren) {
	return (
		<Nav.Item>
			<Nav.Link active={id === value} disabled={disabled} onClick={() => setValue(id)}>
				{children}
			</Nav.Link>
		</Nav.Item>
	);
}
