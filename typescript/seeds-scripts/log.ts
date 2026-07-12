import pino from "pino";

const useJson = process.env.LOG_JSON === "1" || process.env.LOG_JSON === "true";

export const log = pino({
	level: process.env.LOG_LEVEL ?? "info",
	...(useJson
		? {}
		: {
				transport: {
					options: { colorize: true },
					target: "pino-pretty",
				},
			}),
});
