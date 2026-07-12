/**
 * Strips off all the nasty developer-prudence stuff.
 */
export function HumaniseError(err: string): string {
	return err.split(/(\[K:|\(Received)/u)[0]!;
}
