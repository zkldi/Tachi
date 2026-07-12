// These types are more comprehensive than those included with react-bootstrap
export type TextColour =
	| "black"
	| "body"
	| "body-secondary"
	| "body-tertiary"
	| "danger"
	| "danger-emphasis"
	| "dark"
	| "dark-emphasis"
	| "info"
	| "info-emphasis"
	| "light"
	| "light-emphasis"
	| "primary"
	| "primary-emphasis"
	| "secondary"
	| "secondary-emphasis"
	| "success"
	| "success-emphasis"
	| "warning"
	| "warning-emphasis"
	| "white";

export type Colour =
	| "black"
	| "body"
	| "body-secondary"
	| "body-tertiary"
	| "danger"
	| "danger-subtle"
	| "dark"
	| "dark-subtle"
	| "info"
	| "info-subtle"
	| "light"
	| "light-subtle"
	| "primary"
	| "primary-subtle"
	| "secondary"
	| "secondary-subtle"
	| "success"
	| "success-subtle"
	| "warning"
	| "warning-subtle"
	| "white";

// LinkContainer doesn't export its prop types
export interface LinkContainerProps {
	children: React.ReactNode;
	onClick?: React.MouseEventHandler<HTMLElement>;
	replace?: boolean;
	to: string | { pathname: string };
	state?: object;
	className?: string;
	activeClassName?: string;
	style?: React.CSSProperties;
	activeStyle?: React.CSSProperties;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	isActive?: ((match: any, location: any) => boolean) | boolean;
}
