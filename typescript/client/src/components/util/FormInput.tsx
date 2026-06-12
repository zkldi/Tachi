import { type SetState } from "#types/react";
import { Form, type FormControlProps, InputGroup } from "react-bootstrap";

export default function FormInput({
	fieldName,
	setValue,
	...props
}: {
	fieldName: string;
	setValue: SetState<string>;
} & FormControlProps) {
	return (
		<InputGroup>
			<InputGroup.Text>{fieldName}</InputGroup.Text>
			<Form.Control onChange={(e) => setValue(e.target.value)} {...props} />
		</InputGroup>
	);
}
