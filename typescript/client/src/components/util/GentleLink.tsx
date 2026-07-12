import { type JustChildren } from "#types/react";
import { Link } from "react-router-dom";

export default function GentleLink({
	to,
	children,
	className,
	style,
}: {
	className?: string;
	style?: React.CSSProperties;
	to: string;
} & JustChildren) {
	return (
		<Link
			className={["text-decoration-none", className].filter(Boolean).join(" ")}
			style={style}
			to={to}
		>
			{children}
		</Link>
	);
}
