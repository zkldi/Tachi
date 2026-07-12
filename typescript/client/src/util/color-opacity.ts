/**
 * Really awful method for changing the opacity of colour strings. genuinely terrible hack.
 * @param opacity A value between 0 and 1.
 */
export function ChangeOpacity(str: string, opacity: number) {
	if (!str) {
		return "#000000";

		// throw new Error(`Str given to ChangeOpacity was undefined.`);
	}

	if (str.startsWith("#")) {
		if (str.length === 7) {
			return str + Math.floor(opacity * 255).toString(16);
		}

		return str.slice(0, 7) + Math.floor(opacity * 255).toString(16);
	} else if (str.startsWith("rgba(")) {
		return str.replace(/, ?[0-9.]+\)$/u, `,${opacity})`);
	} else if (str.startsWith("rgb(")) {
		return str.replace(/^rgb\(/u, "rgba(").replace(/\)$/u, `,${opacity})`);
	}

	throw new Error(`Unexpected colour ${str}.`);
}
