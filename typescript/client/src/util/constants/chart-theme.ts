import { type Theme } from "@nivo/core";

export const TACHI_BAR_THEME: Theme = {
	background: "none",
	textColor: "var(--bs-body-color)",
	fontSize: 11,
	fontFamily: "Poppins",
	axis: {
		domain: {
			line: {
				stroke: "var(--bs-secondary-color)",
				strokeWidth: 1,
			},
		},
		ticks: {
			line: {
				stroke: "var(--bs-tertiary-color)",
				strokeWidth: 1,
			},
		},
	},
	grid: {
		line: {
			stroke: "var(--bs-tertiary-color)",
			strokeWidth: 1,
		},
	},
	crosshair: {
		line: {
			stroke: "var(--bs-emphasis-color)",
		},
	},
};

export const TACHI_LINE_THEME: Theme = {
	background: "none",
	textColor: "var(--bs-body-color)",
	fontSize: 11,
	fontFamily: "Poppins",
	axis: {
		ticks: {
			line: {
				stroke: "var(--bs-tertiary-color)",
				strokeWidth: 1,
			},
		},
	},
	grid: {
		line: {
			stroke: "var(--bs-tertiary-color)",
			strokeWidth: 1,
		},
	},
};
