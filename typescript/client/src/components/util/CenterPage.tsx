import { type JustChildren } from "#types/react";

export default function CenterPage({
	children,
	className = "",
	...props
}: JustChildren & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={`container d-flex flex-column min-vh-100 justify-content-center align-items-center ${className}`}
			{...props}
		>
			{children}
		</div>
	);
}
