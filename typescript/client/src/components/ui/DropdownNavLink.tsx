import DropdownItem from "react-bootstrap/DropdownItem";
import { NavLink, type NavLinkProps } from "react-router-dom";

export default function DropdownNavLink({
	to,
	children,
	className = "",
	...props
}: { children: React.ReactNode; to: string } & NavLinkProps) {
	return (
		<DropdownItem
			as={NavLink}
			className={`rounded focus-visible-ring ${className}`}
			to={to}
			{...props}
		>
			{children}
		</DropdownItem>
	);
}
