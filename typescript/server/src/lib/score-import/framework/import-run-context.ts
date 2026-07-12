import { AsyncLocalStorage } from "node:async_hooks";

interface ImportRunStore {
	importId: string;
}

const importRunStorage = new AsyncLocalStorage<ImportRunStore>();

export function getActiveImportId(): string | null {
	return importRunStorage.getStore()?.importId ?? null;
}

export function runWithImportContext<T>(importId: string, fn: () => Promise<T>): Promise<T> {
	return importRunStorage.run({ importId }, fn);
}
