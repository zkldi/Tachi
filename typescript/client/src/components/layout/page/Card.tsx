import { type JustChildren } from "#types/react";
import React, { type CSSProperties } from "react";

export default function Card({
	header,
	children,
	footer,
	className,
	cardBodyClassName = "",
	style,
}: {
	cardBodyClassName?: string;
	className?: string;
	footer?: string | JSX.Element;
	header?: string | JSX.Element;
	style?: CSSProperties;
} & JustChildren) {
	return (
		<div className={`card card-custom ${className ? className : ""}`} style={style}>
			{header && (
				<div className="card-header">
					{typeof header === "string" ? (
						<h3 className="text-center mb-0">{header}</h3>
					) : (
						header
					)}
				</div>
			)}
			<div className={`card-body ${cardBodyClassName}`}>{children}</div>
			{footer && <div className="card-footer">{footer}</div>}
		</div>
	);
}
