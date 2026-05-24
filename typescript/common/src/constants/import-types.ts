import type {
	APIImportTypes,
	FileUploadImportTypes,
	ImportTypes,
	IRImportTypes,
} from "../types/import-types";

// silly hack to enforce that we *definitely* define all these things.
const FILE_IMPORT_TYPES: Record<FileUploadImportTypes, true> = {
	"file/eamusement-iidx-csv": true,
	"file/eamusement-sdvx-csv": true,
	"file/batch-manual": true,
	"file/solid-state-squad": true,
	"file/pli-iidx-csv": true,
	"file/mypagescraper-records-csv": true,
	"file/mypagescraper-player-csv": true,
	"file/import-class": true,
};

const IR_IMPORT_TYPES: Record<IRImportTypes, true> = {
	"ir/direct-manual": true,
	"ir/barbatos": true,
	"ir/fervidex": true,
	"ir/fervidex-static": true,
	"ir/beatoraja": true,
	"ir/usc": true,
	"ir/kshook-sv6c": true,
	"ir/kshook-sv6c-static": true,
	"ir/lr2hook": true,
};

const API_IMPORT_TYPES: Record<APIImportTypes, true> = {
	"api/eag-iidx": true,
	"api/eag-sdvx": true,
	"api/flo-iidx": true,
	"api/flo-sdvx": true,
	"api/min-sdvx": true,
	"api/myt-chunithm": true,
	"api/myt-maimaidx": true,
	"api/myt-ongeki": true,
	"api/myt-wacca": true,
	"api/cg-dev-jubeat": true,
	"api/cg-dev-museca": true,
	"api/cg-dev-popn": true,
	"api/cg-dev-sdvx": true,
	"api/cg-nag-jubeat": true,
	"api/cg-nag-museca": true,
	"api/cg-nag-popn": true,
	"api/cg-nag-sdvx": true,
	"api/cg-gan-jubeat": true,
	"api/cg-gan-museca": true,
	"api/cg-gan-popn": true,
	"api/cg-gan-sdvx": true,
};

export const fileImportTypes: Array<FileUploadImportTypes> = Object.keys(
	FILE_IMPORT_TYPES,
) as Array<FileUploadImportTypes>;

export const irImportTypes: Array<IRImportTypes> = Object.keys(
	IR_IMPORT_TYPES,
) as Array<IRImportTypes>;

export const apiImportTypes: Array<APIImportTypes> = Object.keys(
	API_IMPORT_TYPES,
) as Array<APIImportTypes>;

export const allImportTypes: Array<ImportTypes> = [
	...fileImportTypes,
	...irImportTypes,
	...apiImportTypes,
];
