import { DoesMatchRoute } from "#util/routing";
import { type ButtonVariant } from "react-bootstrap/esm/types";

import LinkButton, { type LinkButtonProps } from "./LinkButton";

export default function SelectLinkButton({
	children,
	className = "",
	onVariant = "primary",
	offVariant = "outline-secondary",
	to,
	matchIfStartsWith = false,
	...props
}: {
	matchIfStartsWith?: boolean;
	offVariant?: ButtonVariant;
	onVariant?: ButtonVariant;
	to: string;
} & LinkButtonProps) {
	const match = DoesMatchRoute(window.location.href, to, !matchIfStartsWith);
	const variant = match ? onVariant : offVariant;
	const classNames = `${
		match ? "" : "text-body text-light-hover text-light-focus"
	} ${className} text-wrap`;

	return (
		<LinkButton
			isActive={() => match}
			size="lg"
			to={to}
			variant={variant}
			{...props}
			className={classNames}
		>
			<div className="d-none d-lg-block">{children}</div>
			<div
				className="d-lg-none"
				style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
			>
				{children}
			</div>
		</LinkButton>
	);
}
