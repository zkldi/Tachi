import { describe, expect, it } from "vitest";

import { parseJobQueueWorkerOptions } from "./parse-worker-options";

describe("parseJobQueueWorkerOptions", () => {
	describe("defaults", () => {
		it("returns workerCount 1 when argv and env are empty", () => {
			expect(parseJobQueueWorkerOptions([], {})).toStrictEqual({ workerCount: 1 });
		});
	});

	describe("env var TACHI_JOB_QUEUE_WORKER_POOL", () => {
		it("parses a valid integer", () => {
			expect(
				parseJobQueueWorkerOptions([], { TACHI_JOB_QUEUE_WORKER_POOL: "4" }),
			).toStrictEqual({ workerCount: 4 });
		});

		it("clamps values below 1 to default", () => {
			expect(
				parseJobQueueWorkerOptions([], { TACHI_JOB_QUEUE_WORKER_POOL: "0" }),
			).toStrictEqual({ workerCount: 1 });
		});

		it("ignores non-integer values and falls back to default", () => {
			expect(
				parseJobQueueWorkerOptions([], { TACHI_JOB_QUEUE_WORKER_POOL: "banana" }),
			).toStrictEqual({ workerCount: 1 });
		});

		it("ignores empty string and falls back to default", () => {
			expect(
				parseJobQueueWorkerOptions([], { TACHI_JOB_QUEUE_WORKER_POOL: "" }),
			).toStrictEqual({ workerCount: 1 });
		});

		it("ignores negative values and falls back to default", () => {
			expect(
				parseJobQueueWorkerOptions([], { TACHI_JOB_QUEUE_WORKER_POOL: "-3" }),
			).toStrictEqual({ workerCount: 1 });
		});
	});

	describe("CLI --workers argument", () => {
		it("parses --workers N (space-separated)", () => {
			expect(parseJobQueueWorkerOptions(["--workers", "8"], {})).toStrictEqual({
				workerCount: 8,
			});
		});

		it("parses --workers=N (equals form)", () => {
			expect(parseJobQueueWorkerOptions(["--workers=3"], {})).toStrictEqual({
				workerCount: 3,
			});
		});

		it("ignores non-integer --workers N and falls back to env", () => {
			expect(
				parseJobQueueWorkerOptions(["--workers", "abc"], {
					TACHI_JOB_QUEUE_WORKER_POOL: "2",
				}),
			).toStrictEqual({ workerCount: 2 });
		});

		it("ignores --workers=0 and falls back to env", () => {
			expect(
				parseJobQueueWorkerOptions(["--workers=0"], { TACHI_JOB_QUEUE_WORKER_POOL: "5" }),
			).toStrictEqual({ workerCount: 5 });
		});

		it("ignores --workers N when N is missing (end of argv) and falls back to env", () => {
			expect(
				parseJobQueueWorkerOptions(["--workers"], { TACHI_JOB_QUEUE_WORKER_POOL: "3" }),
			).toStrictEqual({ workerCount: 3 });
		});

		it("--workers takes precedence over env when both are valid", () => {
			expect(
				parseJobQueueWorkerOptions(["--workers=6"], { TACHI_JOB_QUEUE_WORKER_POOL: "2" }),
			).toStrictEqual({ workerCount: 6 });
		});

		it("tolerates other CLI args before --workers", () => {
			expect(parseJobQueueWorkerOptions(["--some-flag", "--workers", "4"], {})).toStrictEqual(
				{ workerCount: 4 },
			);
		});

		it("workerCount 1 is valid (does not clamp up)", () => {
			expect(parseJobQueueWorkerOptions(["--workers=1"], {})).toStrictEqual({
				workerCount: 1,
			});
		});
	});
});
