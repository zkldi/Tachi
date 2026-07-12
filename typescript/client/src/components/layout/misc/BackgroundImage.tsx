import { BackgroundContext } from "#context/BackgroundContext";
import { ToCDNURL } from "#util/api";
import { DEFAULT_GAME_BANNER_REL_PATH } from "#util/game-group-banner-counts";
import React, { useContext, useEffect, useRef, useState } from "react";

import { type LayoutStyles } from "../Layout";

export default function BackgroundImage({ styles }: { styles: LayoutStyles }) {
	const { background } = useContext(BackgroundContext);
	const resolvedBg = background
		? `url(${background})`
		: `url(${ToCDNURL(DEFAULT_GAME_BANNER_REL_PATH)})`;

	const [committedBg, setCommittedBg] = useState(resolvedBg);
	const [incomingBg, setIncomingBg] = useState<string | null>(null);
	const [incomingVisible, setIncomingVisible] = useState(false);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (resolvedBg === committedBg) {
			return;
		}

		setIncomingBg(resolvedBg);
		setIncomingVisible(false);

		// Two rAF calls to ensure the browser paints the element at opacity 0 first,
		// so the transition from 0 → 1 actually fires.
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = requestAnimationFrame(() => {
				setIncomingVisible(true);
			});
		});

		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [resolvedBg]);

	function handleTransitionEnd() {
		if (incomingBg !== null && incomingVisible) {
			setCommittedBg(incomingBg);
			setIncomingBg(null);
			setIncomingVisible(false);
		}
	}

	const baseStyle: React.CSSProperties = {
		backgroundRepeat: "no-repeat",
		backgroundPosition: "center",
		backgroundSize: "cover",
		position: "absolute",
		top: `${styles.headerHeight}px`,
		width: "100%",
		height: styles.backgroundHeight,
	};

	return (
		<>
			<div style={{ ...baseStyle, backgroundImage: committedBg, zIndex: -2 }} />
			{incomingBg !== null && (
				<div
					onTransitionEnd={handleTransitionEnd}
					style={{
						...baseStyle,
						backgroundImage: incomingBg,
						opacity: incomingVisible ? 1 : 0,
						transition: "opacity 0.3s ease-in-out",
						zIndex: -1,
					}}
				/>
			)}
		</>
	);
}
