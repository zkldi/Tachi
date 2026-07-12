import { type LinkContainerProps } from "#types/bootstrap";
import Button, { type ButtonProps } from "react-bootstrap/Button";
import { LinkContainer } from "react-router-bootstrap";

export type LinkButtonProps = LinkContainerProps & Omit<ButtonProps, "as">;

/**
 * A Bootstrap Button component that acts like a react-router Link
 */
export default function LinkButton({
	to,
	activeClassName,
	activeStyle,
	isActive,
	replace,
	state,
	children,
	style,
	className,
	...props
}: LinkButtonProps) {
	return (
		<LinkContainer
			activeClassName={activeClassName}
			activeStyle={activeStyle}
			className={className}
			isActive={isActive}
			replace={replace}
			state={state}
			style={style}
			to={to}
		>
			<Button {...props}>{children}</Button>
		</LinkContainer>
	);
}
