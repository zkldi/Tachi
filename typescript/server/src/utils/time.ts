export function UnixMillisecondsToISO8601(ms: number) {
	return new Date(ms).toISOString();
}

export function ISO8601ToUnixMilliseconds(iso: string) {
	return new Date(iso).getTime();
}

export function NowISO8601() {
	return UnixMillisecondsToISO8601(Date.now());
}
