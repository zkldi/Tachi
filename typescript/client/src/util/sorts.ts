export function PropSort(...props: string[]) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (a: any, b: any) => {
		let a2 = a;
		let b2 = b;
		for (const prop of props) {
			a2 = a2[prop];
			b2 = b2[prop];
		}

		return a2 - b2;
	};
}

/**
 * Sorts On Value numerically.
 * @returns A sorting function
 */
export function NumericSOV<T>(getValueFn: (data: T) => number, reverse = false) {
	if (reverse) {
		return (a: T, b: T) => getValueFn(b) - getValueFn(a);
	}
	return (a: T, b: T) => getValueFn(a) - getValueFn(b);
}

/**
 * Sorts On Value using locale compare.
 * @returns A sorting function
 */
export function StrSOV<T>(getValueFn: (data: T) => string) {
	return (a: T, b: T) => getValueFn(a).localeCompare(getValueFn(b));
}
