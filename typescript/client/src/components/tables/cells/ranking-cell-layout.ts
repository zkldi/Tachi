import type { CSSProperties } from "react";

/** Body + `<th>` must agree or `auto` tables size the column from the widest header cell. */
export const RANKING_CELL_WIDTH_PX = 104;

const rankingColumnBox: Pick<
	CSSProperties,
	"boxSizing" | "maxWidth" | "minWidth" | "overflow" | "whiteSpace" | "width"
> = {
	boxSizing: "border-box",
	maxWidth: "none",
	minWidth: `${RANKING_CELL_WIDTH_PX}px`,
	overflow: "visible",
	whiteSpace: "nowrap",
	width: `${RANKING_CELL_WIDTH_PX}px`,
};

/** `<td>` ranking column */
export const rankingColumnTdStyle: CSSProperties = {
	...rankingColumnBox,
	textAlign: "center",
	verticalAlign: "middle",
};

/** Matching `<th>` so the column does not expand from header content */
export const rankingColumnThStyle: CSSProperties = {
	...rankingColumnBox,
	paddingBlock: "0.2rem",
	paddingInline: "0.125rem",
	textAlign: "center",
	verticalAlign: "middle",
};
