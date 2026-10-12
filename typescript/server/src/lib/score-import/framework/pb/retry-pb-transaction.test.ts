import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { retryPbTransaction } from "./retry-pb-transaction";

const leaderboardError = () =>
	Object.assign(new Error("duplicate leaderboard row"), {
		code: "23505",
		constraint: "chart_leaderboard_new_pkey",
	});

describe("retryPbTransaction", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("runs a successful transaction once without sleeping or logging", async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const log = { warn: vi.fn() };

		await retryPbTransaction(run, log);

		expect(run).toHaveBeenCalledTimes(1);
		expect(log.warn).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([
		["leaderboard duplicate", leaderboardError()],
		["deadlock", Object.assign(new Error("deadlock"), { code: "40P01" })],
		["serialization failure", Object.assign(new Error("serialization"), { code: "40001" })],
	])("retries a %s after backoff", async (_, error) => {
		const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const log = { warn: vi.fn() };
		const pending = retryPbTransaction(run, log);

		await vi.advanceTimersByTimeAsync(49);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await pending;

		expect(run).toHaveBeenCalledTimes(2);
		expect(log.warn).toHaveBeenCalledWith(
			{ err: error, attempt: 1, delayMs: 50 },
			expect.any(String),
		);
	});

	it("gives up after five attempts and propagates the last error", async () => {
		const finalError = leaderboardError();
		const run = vi.fn().mockRejectedValue(leaderboardError());
		run.mockRejectedValueOnce(leaderboardError())
			.mockRejectedValueOnce(leaderboardError())
			.mockRejectedValueOnce(leaderboardError())
			.mockRejectedValueOnce(leaderboardError())
			.mockRejectedValueOnce(finalError);
		const log = { warn: vi.fn() };
		const outcome = retryPbTransaction(run, log).catch((err: unknown) => err);

		await vi.runAllTimersAsync();

		expect(await outcome).toBe(finalError);
		expect(run).toHaveBeenCalledTimes(5);
		expect(log.warn.mock.calls.map(([context]) => context.delayMs)).toEqual([
			50, 100, 200, 400,
		]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("adds jitter to the backoff", async () => {
		vi.mocked(Math.random).mockReturnValue(0.5);
		const run = vi.fn().mockRejectedValueOnce(leaderboardError()).mockResolvedValue(undefined);
		const log = { warn: vi.fn() };
		const pending = retryPbTransaction(run, log);

		await vi.runAllTimersAsync();
		await pending;

		expect(log.warn).toHaveBeenCalledWith(
			expect.objectContaining({ delayMs: 75 }),
			expect.any(String),
		);
	});

	it.each([
		["another unique constraint", { code: "23505", constraint: "pb_pkey" }],
		["a unique violation without a constraint", { code: "23505" }],
		[
			"the leaderboard constraint with another code",
			{ code: "23503", constraint: "chart_leaderboard_new_pkey" },
		],
		["connection failure with an unknown commit outcome", { code: "08006" }],
		["an ordinary error", new Error("bug")],
		["null", null],
		["a non-object throw", "bug"],
	])("does not retry %s", async (_, error) => {
		const run = vi.fn().mockRejectedValue(error);
		const log = { warn: vi.fn() };

		await expect(retryPbTransaction(run, log)).rejects.toBe(error);

		expect(run).toHaveBeenCalledTimes(1);
		expect(log.warn).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("stops immediately if a retry hits a non-retryable error", async () => {
		const error = new Error("permanent failure");
		const run = vi.fn().mockRejectedValueOnce(leaderboardError()).mockRejectedValueOnce(error);
		const log = { warn: vi.fn() };
		const outcome = retryPbTransaction(run, log).catch((err: unknown) => err);

		await vi.runAllTimersAsync();

		expect(await outcome).toBe(error);
		expect(run).toHaveBeenCalledTimes(2);
		expect(log.warn).toHaveBeenCalledTimes(1);
	});
});
