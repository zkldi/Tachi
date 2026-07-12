import { nanoid } from "nanoid";
import React, { type CSSProperties, useState } from "react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

export default function QuickTooltip({
	children,
	tooltipContent,
	wide,
	style,
	max,
	delay = 40,
	tooltipClassName,
	keepOpenWhenHoveringTooltip = true,
}: {
	children: JSX.Element;
	delay?: number | { hide?: number; show?: number };
	/** When false, the tooltip hides as soon as the pointer leaves the trigger (overlay is not hoverable). */
	keepOpenWhenHoveringTooltip?: boolean;
	max?: boolean;
	style?: CSSProperties;
	tooltipClassName?: string;
	tooltipContent: React.ReactChild | undefined;
	wide?: boolean;
}) {
	const [show, setShow] = useState(false);
	const [mousedOver, setMousedOver] = useState(false);

	if (tooltipContent === undefined || tooltipContent === null) {
		return children;
	}

	const overlayDelay: number | { hide: number; show: number } =
		typeof delay === "number"
			? delay
			: {
					hide: delay.hide ?? 0,
					show: delay.show ?? 0,
				};

	const overlayClass =
		[tooltipClassName, wide ? "tooltip-wide" : null, max ? "tooltip-max" : null]
			.filter(Boolean)
			.join(" ") || undefined;

	// Plain text: native title — no Popper instance per row (huge win on large tables).
	const useNativeTitle =
		(typeof tooltipContent === "string" || typeof tooltipContent === "number") &&
		!wide &&
		!max &&
		!style &&
		!tooltipClassName;

	if (useNativeTitle) {
		const t = String(tooltipContent);
		const prevTitle = children.props.title;
		return React.cloneElement(children, {
			title: typeof prevTitle === "string" && prevTitle !== "" ? `${prevTitle}\n${t}` : t,
		});
	}

	// Mount OverlayTrigger from the first paint. A lazy first render used cloneElement only,
	// then swapped to OverlayTrigger on hover; that remounted the trigger and restarted CSS animations.
	return (
		<OverlayTrigger
			delay={overlayDelay}
			onToggle={(nextShow) => setShow(nextShow)}
			overlay={
				<Tooltip
					className={overlayClass}
					id={nanoid()}
					onMouseEnter={
						keepOpenWhenHoveringTooltip ? () => setMousedOver(true) : undefined
					}
					onMouseLeave={
						keepOpenWhenHoveringTooltip ? () => setMousedOver(false) : undefined
					}
					style={style}
				>
					{tooltipContent}
				</Tooltip>
			}
			placement="top"
			show={keepOpenWhenHoveringTooltip ? show || mousedOver : show}
		>
			{children}
		</OverlayTrigger>
	);
}
