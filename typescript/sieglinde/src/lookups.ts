const TableValueGetters: Record<
	| "DP Insane"
	| "DP Normal"
	| "Insane"
	| "Insane2"
	| "Normal"
	| "Normal2"
	| "Overjoy"
	| "Satellite"
	| "Stella",
	(x: number | string) => number | null
> = {
	Insane: (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n + 12;
	},
	Insane2: (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n + 12;
	},
	"DP Normal": (c) => {
		// delta 99 is a real folder
		if (c === "99") {
			return null;
		}

		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n;
	},
	"DP Insane": (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n + 12;
	},
	Normal: (c) => {
		if (c === "11+") {
			return 11.5;
		} else if (c === "12-") {
			return 11.8;
		} else if (c === "12+") {
			return 12.5;
		}

		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n;
	},
	Normal2: (c) => {
		if (c === "11+") {
			return 11.5;
		} else if (c === "12-") {
			return 11.8;
		} else if (c === "12+") {
			return 12.5;
		}

		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n;
	},
	Overjoy: (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return n + 12 + 20;
	},
	Satellite: (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return (
			[0, 1.5, 3, 4.5, 6.5, 8.5, 10.5, 12, 13.5, 15.5, 16.5, 17.5, 19].map((e) => e + 12)[
				n
			] ?? null
		);
	},
	Stella: (c) => {
		const n = Number(c);

		if (Number.isNaN(n)) {
			return null;
		}

		return (
			[19.5, 21, 22, 22.5, 23.5, 24, 24.25, 24.5, 24.75, 25, 25.5, 26, 27, 27.5].map(
				(e) => e + 12,
			)[n] ?? null
		);
	},
} as const;

export default TableValueGetters;
