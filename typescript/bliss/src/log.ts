import pino from "pino";
import pretty from "pino-pretty";

export type Logger = pino.Logger;

// Use JSON log lines when LOG_JSON=1 (dev/prod); otherwise pretty format for localdev.
const useJson = process.env.LOG_JSON === "1" || process.env.LOG_JSON === "true";

// pino's transport API spawns a worker thread, which Bun doesn't handle well.
// Using a pino-pretty stream directly avoids the worker thread entirely.
export const log = useJson
	? pino({ level: process.env.LOG_LEVEL ?? "info" })
	: pino({ level: process.env.LOG_LEVEL ?? "info" }, pretty({ colorize: true }));

export function AppendLogCtx(context: string, parent: Logger = log): Logger {
	return parent.child({ context });
}

export function ChangeRootLogLevel(level: string): void {
	log.level = level;
}

export function GetLogLevel(): string {
	return log.level;
}
