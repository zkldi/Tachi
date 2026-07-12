import { Form } from "react-bootstrap";

export default function Select<T extends string | null>({
	value,
	setValue,
	children,
	allowNull = false,
	style,
	className = "",
	unselectedName = "Select...",
	name,
	description,
	noMarginBottom,
	inline = false,
}: {
	allowNull?: boolean;
	children: React.ReactNode;
	className?: string;
	description?: string;
	inline?: boolean;
	name?: string;
	noMarginBottom?: boolean;
	setValue: (value: T) => void;
	style?: React.CSSProperties;
	unselectedName?: string;
	value: T;
}) {
	return (
		<Form.Group
			style={{
				marginBottom: noMarginBottom ? "unset" : undefined,
				display: inline ? "inline" : undefined,
			}}
		>
			{name && <Form.Label>{name}</Form.Label>}
			<Form.Select
				className={`mx-2 ${className}`}
				onChange={(e) => setValue((e.target.value === "" ? null : e.target.value) as T)}
				style={{ width: "unset", display: "inline", ...style }}
				value={value ?? ""}
			>
				{allowNull && <option value="">{unselectedName}</option>}
				{children}
			</Form.Select>
			{description && <Form.Text className="text-body-secondary">{description}</Form.Text>}
		</Form.Group>
	);
}
