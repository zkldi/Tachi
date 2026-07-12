import React, { useCallback, useEffect, useRef, useState } from "react";

import classes from "./CustomScrollbar.module.scss";

const THUMB_MIN_PX = 32;

function readMetrics() {
	const root = document.documentElement;
	return {
		scrollTop: root.scrollTop,
		scrollHeight: root.scrollHeight,
		clientHeight: root.clientHeight,
	};
}

/**
 * Hides the native document scrollbar via global CSS; renders a fixed overlay
 * track so layout width stays stable while scrolling.
 */
export function CustomScrollbar() {
	const [metrics, setMetrics] = useState(readMetrics);
	const thumbRef = useRef<HTMLDivElement>(null);

	const update = useCallback(() => {
		setMetrics(readMetrics());
	}, []);

	useEffect(() => {
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		const ro = new ResizeObserver(update);
		ro.observe(document.documentElement);
		ro.observe(document.body);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			ro.disconnect();
		};
	}, [update]);

	const { scrollTop, scrollHeight, clientHeight } = metrics;
	const scrollable = Math.max(0, scrollHeight - clientHeight);
	const show = scrollable > 1;

	const thumbH =
		scrollable <= 0 ? 0 : Math.max(THUMB_MIN_PX, (clientHeight / scrollHeight) * clientHeight);
	const thumbTravel = Math.max(0, clientHeight - thumbH);
	const thumbTop = scrollable <= 0 ? 0 : (scrollTop / scrollable) * thumbTravel;

	const onThumbPointerDown = (e: React.PointerEvent) => {
		if (e.button !== 0) {
			return;
		}
		e.preventDefault();
		const startY = e.clientY;
		const startScrollTop = document.documentElement.scrollTop;

		const onMove = (ev: PointerEvent) => {
			const cur = readMetrics();
			const sc = Math.max(0, cur.scrollHeight - cur.clientHeight);
			if (sc <= 0) {
				return;
			}
			const tH = Math.max(
				THUMB_MIN_PX,
				(cur.clientHeight / cur.scrollHeight) * cur.clientHeight,
			);
			const tTrack = Math.max(0, cur.clientHeight - tH);
			if (tTrack <= 0) {
				return;
			}
			const deltaY = ev.clientY - startY;
			const next = startScrollTop + (deltaY / tTrack) * sc;
			document.documentElement.scrollTop = Math.max(0, Math.min(sc, next));
		};

		const onUp = (ev: PointerEvent) => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			document.body.style.removeProperty("user-select");
			if (thumbRef.current?.hasPointerCapture(ev.pointerId)) {
				thumbRef.current.releasePointerCapture(ev.pointerId);
			}
		};

		thumbRef.current?.setPointerCapture(e.pointerId);
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	};

	const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0 || thumbRef.current?.contains(e.target as Node)) {
			return;
		}
		const thumbEl = thumbRef.current;
		if (!thumbEl) {
			return;
		}
		const thumbRect = thumbEl.getBoundingClientRect();
		const mid = thumbRect.top + thumbRect.height / 2;
		const page = clientHeight * 0.85;
		if (e.clientY < mid) {
			document.documentElement.scrollBy({ top: -page });
		} else {
			document.documentElement.scrollBy({ top: page });
		}
	};

	if (!show) {
		return null;
	}

	return (
		<div
			aria-hidden
			className={classes.track}
			onPointerDown={onTrackPointerDown}
			role="presentation"
		>
			<div className={classes.trackInner}>
				<div
					className={classes.thumb}
					onPointerDown={onThumbPointerDown}
					ref={thumbRef}
					style={{ height: thumbH, top: thumbTop }}
				/>
			</div>
		</div>
	);
}
