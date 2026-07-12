import Icon from "#components/util/Icon";
import Dropdown from "react-bootstrap/Dropdown";
import { type DropdownToggleProps } from "react-bootstrap/esm/DropdownToggle";
import { type AlignType } from "react-bootstrap/esm/types";

export interface QuickDropdownProps extends DropdownToggleProps {
	/**
	 * Text or JSX to render in the toggle button
	 */
	toggle: React.ReactNode;
	/**
	 * Render a caret
	 */
	caret?: boolean;
	caretPosition?: "end" | "start";
	/**
	 * Which position of the toggle the dropdown should align to
	 */
	align?: AlignType;
	menuStyle?: React.CSSProperties;
	menuClassName?: string;
	dropdownClassName?: string;
}

export default function QuickDropdown({
	align,
	id,
	variant = "dark",
	toggle,
	caret,
	caretPosition = "end",
	className = "",
	menuStyle,
	menuClassName = "",
	dropdownClassName,
	children,
	...props
}: QuickDropdownProps) {
	const caretClassName = caretPosition === "start" ? "me-4" : "ms-4";
	return (
		<Dropdown align={align} className={dropdownClassName} id={id}>
			<Dropdown.Toggle
				className={`${className} fw-semibold align-items-center d-flex${
					caret && caretPosition === "start" ? " flex-row-reverse" : ""
				}`}
				id={id ? `${id}-toggle` : undefined}
				variant={variant}
				{...props}
			>
				{toggle}
				{caret && <Icon className={`small ${caretClassName}`} type="chevron-down" />}
			</Dropdown.Toggle>
			<Dropdown.Menu
				className={`animate-fade-in ${menuClassName}`}
				id={id ? `${id}-menu` : undefined}
				style={menuStyle}
			>
				{children}
			</Dropdown.Menu>
		</Dropdown>
	);
}
