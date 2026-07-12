import { type JustChildren } from "#types/react";

export default function CardHeader({
	rightContent,
	children,
}: { rightContent?: JSX.Element | null } & JustChildren) {
	return (
		<div
			className="d-flex w-100 justify-content-center align-items-center text-center"
			style={{ position: "relative" }}
		>
			{children}
			<div style={{ position: "absolute", right: 0 }}>{rightContent}</div>
		</div>
	);
}
