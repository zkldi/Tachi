export type FileUploadImportTypes =
	| "file/batch-manual"
	| "file/eamusement-iidx-csv"
	| "file/eamusement-sdvx-csv"
	| "file/import-class"
	| "file/mypagescraper-player-csv"
	| "file/mypagescraper-records-csv"
	| "file/pli-iidx-csv"
	| "file/solid-state-squad";

export type APIImportTypes =
	| "api/eag-iidx"
	| "api/eag-sdvx"
	| "api/flo-iidx"
	| "api/flo-sdvx"
	| "api/min-sdvx"
	| "api/myt-chunithm"
	| "api/myt-maimaidx"
	| "api/myt-ongeki"
	| "api/myt-wacca"

	// cg has dev and prod supported
	// with four games.
	// this typescript feature for stringliteral expansion is kinda neat.
	| `api/cg-${"dev" | "gan" | "nag"}-${"jubeat" | "museca" | "popn" | "sdvx"}`;

export type IRImportTypes =
	| "ir/barbatos"
	| "ir/beatoraja"
	| "ir/direct-manual"
	| "ir/fervidex"
	| "ir/fervidex-static"
	| "ir/kshook-sv6c"
	| "ir/kshook-sv6c-static"
	| "ir/lr2hook"
	| "ir/usc";

export type ImportTypes = APIImportTypes | FileUploadImportTypes | IRImportTypes;
