/* istanbul ignore file */

import { expect } from "vitest";

export function expectThrowsSnapshot(fn: () => unknown, message: string) {
	try {
		fn();

		expect.fail(`DID NOT THROW: ${message}`);
	} catch (e: unknown) {
		const err = e as Error;
		expect(err.message).toMatchSnapshot(message);
	}
}
