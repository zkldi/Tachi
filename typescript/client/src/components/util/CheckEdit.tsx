import { type JustChildren } from "#types/react";
import { Form } from "react-bootstrap";

export default function CheckEdit<T extends string>({
	currentType,
	type,
	onChange,
	children,
}: { currentType: T; onChange: () => void; type: T } & JustChildren) {
	return (
		<div
			className={`my-4 ${currentType !== type ? "text-body-secondary" : ""}`}
			style={{ fontWeight: currentType === type ? "bold" : "" }}
		>
			<Form.Check
				checked={currentType === type}
				className="me-4"
				onChange={onChange}
				style={{ display: "inline" }}
				type="radio"
			/>{" "}
			{children}
		</div>
	);
}
