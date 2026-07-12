export function ParseEA3SoftID(ver: string) {
	const a = ver.split(":");

	if (a.length !== 5) {
		throw new Error(`Invalid Version Code. Had ${a.length} components.`);
	}

	const arr = a as [string, string, string, string, string];

	if (!/^[A-Z0-9]{3}:[A-Z]:[A-Z]:[A-Z]:[0-9]{10}$/u.exec(ver)) {
		throw new Error(`Invalid Version Code.`);
	}

	return {
		model: arr[0],

		// region
		dest: arr[1],

		spec: arr[2],
		rev: arr[3],
		ext: arr[4],
	};
}
