import { ParseEagIIDX } from "./api/eag-iidx/parser";
import { ParseEagSDVX } from "./api/eag-sdvx/parser";
import { ParseFloIIDX } from "./api/flo-iidx/parser";
import { ParseFloSDVX } from "./api/flo-sdvx/parser";
import { ParseMinSDVX } from "./api/min-sdvx/parser";
import ParseMytChunithm from "./api/myt-chunithm/parser";
import ParseMytMaimaiDx from "./api/myt-maimaidx/parser";
import ParseMytOngeki from "./api/myt-ongeki/parser";
import ParseMytWACCA from "./api/myt-wacca/parser";
import {
	ParseCGDevJubeat,
	ParseCGDevMuseca,
	ParseCGDevPopn,
	ParseCGDevSDVX,
	ParseCGGanJubeat,
	ParseCGGanMuseca,
	ParseCGGanPopn,
	ParseCGGanSDVX,
	ParseCGNagJubeat,
	ParseCGNagMuseca,
	ParseCGNagPopn,
	ParseCGNagSDVX,
} from "./common/api-cg/parsers";
import ParseBatchManual from "./file/batch-manual/parser";
import ParseEamusementIIDXCSV from "./file/eamusement-iidx-csv/parser";
import ParseEamusementSDVXCSV from "./file/eamusement-sdvx-csv/parser";
import ParseImportClass from "./file/import-class/parser";
import ParsePLIIIDXCSV from "./file/pli-iidx-csv/parser";
import { ParseSolidStateXML } from "./file/solid-state-squad/parser";
import {
	ParseMyPageScraperPlayerCSV,
	ParseMyPageScraperRecordsCSV,
} from "./file/wacca-mypage-scraper/parser";
import { ParseBarbatosSingle } from "./ir/barbatos/parser";
import { ParseBeatorajaSingle } from "./ir/beatoraja/parser";
import ParseDirectManual from "./ir/direct-manual/parser";
import { ParseFervidexSingle } from "./ir/fervidex/parser";
import { ParseFervidexStatic } from "./ir/fervidex-static/parser";
import { ParseKsHookSV6C } from "./ir/kshook-sv6c/parser";
import { ParseKsHookSV6CStatic } from "./ir/kshook-sv6c-static/parser";
import { ParseLR2Hook } from "./ir/lr2hook/parser";
import { ParseIRUSC } from "./ir/usc/parser";

export const Parsers = {
	"file/solid-state-squad": ParseSolidStateXML,
	"file/batch-manual": ParseBatchManual,
	"file/pli-iidx-csv": ParsePLIIIDXCSV,
	"file/eamusement-iidx-csv": ParseEamusementIIDXCSV,
	"file/eamusement-sdvx-csv": ParseEamusementSDVXCSV,
	"file/mypagescraper-records-csv": ParseMyPageScraperRecordsCSV,
	"file/mypagescraper-player-csv": ParseMyPageScraperPlayerCSV,
	"file/import-class": ParseImportClass,

	"api/eag-iidx": ParseEagIIDX,
	"api/eag-sdvx": ParseEagSDVX,
	"api/flo-iidx": ParseFloIIDX,
	"api/flo-sdvx": ParseFloSDVX,
	"api/min-sdvx": ParseMinSDVX,

	"api/cg-dev-sdvx": ParseCGDevSDVX,
	"api/cg-dev-popn": ParseCGDevPopn,
	"api/cg-dev-museca": ParseCGDevMuseca,
	"api/cg-dev-jubeat": ParseCGDevJubeat,

	"api/cg-nag-sdvx": ParseCGNagSDVX,
	"api/cg-nag-popn": ParseCGNagPopn,
	"api/cg-nag-museca": ParseCGNagMuseca,
	"api/cg-nag-jubeat": ParseCGNagJubeat,

	"api/cg-gan-sdvx": ParseCGGanSDVX,
	"api/cg-gan-popn": ParseCGGanPopn,
	"api/cg-gan-museca": ParseCGGanMuseca,
	"api/cg-gan-jubeat": ParseCGGanJubeat,

	"api/myt-chunithm": ParseMytChunithm,
	"api/myt-maimaidx": ParseMytMaimaiDx,
	"api/myt-ongeki": ParseMytOngeki,
	"api/myt-wacca": ParseMytWACCA,

	"ir/barbatos": ParseBarbatosSingle,
	"ir/beatoraja": ParseBeatorajaSingle,
	"ir/fervidex": ParseFervidexSingle,
	"ir/fervidex-static": ParseFervidexStatic,
	"ir/direct-manual": ParseDirectManual,
	"ir/usc": ParseIRUSC,
	"ir/kshook-sv6c": ParseKsHookSV6C,
	"ir/kshook-sv6c-static": ParseKsHookSV6CStatic,
	"ir/lr2hook": ParseLR2Hook,
}; /* satisfies Record<ImportTypes, ParserFunction<any, any, any>>; */
// ^ not supported in our current version of TS, but undoubtedly useful for
// this kind of work.
