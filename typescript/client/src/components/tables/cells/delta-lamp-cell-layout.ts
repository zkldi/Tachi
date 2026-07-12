import type { CSSProperties } from "react";

/** Two-line grade delta (AAA / MAX-) — fixed width + truncation; full text in `title`. */
export const DELTA_CELL_WIDTH_PX = 128;

/** Lamp (+ optional BP/CB/gauge lines). */
export const LAMP_CELL_WIDTH_PX = 120;

export const constrainedDeltaTdStyle: CSSProperties = {
	boxSizing: "border-box",
	maxWidth: `${DELTA_CELL_WIDTH_PX}px`,
	minWidth: 0,
	overflow: "hidden",
	verticalAlign: "middle",
	width: `${DELTA_CELL_WIDTH_PX}px`,
};

export const constrainedLampTdStyle: CSSProperties = {
	boxSizing: "border-box",
	maxWidth: `${LAMP_CELL_WIDTH_PX}px`,
	minWidth: 0,
	overflow: "hidden",
	verticalAlign: "middle",
	width: `${LAMP_CELL_WIDTH_PX}px`,
};
