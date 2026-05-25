import type { KtLogger } from "#lib/log/log";
import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";
import type { ConverterFailure } from "#lib/score-import/framework/common/converter-failures";
import type { DryScore } from "#lib/score-import/framework/common/types";
import type { USCClientScore } from "#server/router/ir/usc/_playtype/types";
import type { EmptyObject } from "#utils/types";
import type {
	BatchManualScore,
	ChartDocument,
	GameGroup,
	GameGroupFromGame,
	ImportTypes,
	integer,
	SongDocument,
	V3Game,
} from "tachi-common";

import type { MytChunithmScore } from "../api/myt-chunithm/types";
import type { MytMaimaiDxScore } from "../api/myt-maimaidx/types";
import type { MytOngekiScore } from "../api/myt-ongeki/types";
import type { MytWaccaScore } from "../api/myt-wacca/types";
import type { SDVXEamusementCSVData } from "../file/eamusement-sdvx-csv/types";
import type { S3Score } from "../file/solid-state-squad/types";
import type { MyPageRecordsParsedPB } from "../file/wacca-mypage-scraper/types";
import type { BarbatosContext, BarbatosScore, BarbatosSDVX6Score } from "../ir/barbatos/types";
import type { BeatorajaContext, BeatorajaScore } from "../ir/beatoraja/types";
import type { FervidexContext, FervidexScore } from "../ir/fervidex/types";
import type { FervidexStaticContext, FervidexStaticScore } from "../ir/fervidex-static/types";
import type { KsHookSV6CContext, KsHookSV6CScore } from "../ir/kshook-sv6c/types";
import type { KsHookSV6CStaticScore } from "../ir/kshook-sv6c-static/types";
import type { LR2HookContext, LR2HookScore } from "../ir/lr2hook/types";
import type { IRUSCContext } from "../ir/usc/types";
import type {
	CGContext,
	CGJubeatScore,
	CGMusecaScore,
	CGPopnScore,
	CGSDVXScore,
} from "./api-cg/types";
import type { KaiContext } from "./api-kai/types";
import type { BatchManualContext } from "./batch-manual/types";
import type { IIDXEamusementCSVContext, IIDXEamusementCSVData } from "./eamusement-iidx-csv/types";

export interface ImportTypeDataMap {
	"file/eamusement-iidx-csv": IIDXEamusementCSVData;
	"file/eamusement-sdvx-csv": SDVXEamusementCSVData;
	"file/batch-manual": BatchManualScore;
	"file/solid-state-squad": S3Score;
	"file/pli-iidx-csv": IIDXEamusementCSVData;
	"file/mypagescraper-records-csv": MyPageRecordsParsedPB;
	"file/mypagescraper-player-csv": never;
	"file/import-class": never;

	"ir/direct-manual": BatchManualScore;
	"ir/barbatos": BarbatosScore | BarbatosSDVX6Score;
	"ir/fervidex": FervidexScore;
	"ir/fervidex-static": FervidexStaticScore;
	"ir/beatoraja": BeatorajaScore;
	"ir/usc": USCClientScore;
	"ir/kshook-sv6c": KsHookSV6CScore;
	"ir/kshook-sv6c-static": KsHookSV6CStaticScore;
	"ir/lr2hook": LR2HookScore;

	// These aren't placeholder values - the data is yielded in a way that
	// the value of these is legitimately unknown at convert time.
	"api/flo-iidx": unknown;
	"api/flo-sdvx": unknown;
	"api/min-sdvx": unknown;
	"api/eag-iidx": unknown;
	"api/eag-sdvx": unknown;

	"api/myt-chunithm": MytChunithmScore;
	"api/myt-maimaidx": MytMaimaiDxScore;
	"api/myt-ongeki": MytOngekiScore;
	"api/myt-wacca": MytWaccaScore;

	"api/cg-dev-sdvx": CGSDVXScore;
	"api/cg-dev-museca": CGMusecaScore;
	"api/cg-dev-popn": CGPopnScore;
	"api/cg-dev-jubeat": CGJubeatScore;

	"api/cg-nag-sdvx": CGSDVXScore;
	"api/cg-nag-museca": CGMusecaScore;
	"api/cg-nag-popn": CGPopnScore;
	"api/cg-nag-jubeat": CGJubeatScore;

	"api/cg-gan-sdvx": CGSDVXScore;
	"api/cg-gan-museca": CGMusecaScore;
	"api/cg-gan-popn": CGPopnScore;
	"api/cg-gan-jubeat": CGJubeatScore;
}

export interface ImportTypeContextMap {
	"file/eamusement-iidx-csv": IIDXEamusementCSVContext;
	"file/eamusement-sdvx-csv": EmptyObject;
	"file/batch-manual": BatchManualContext;
	"file/solid-state-squad": EmptyObject;
	"file/pli-iidx-csv": IIDXEamusementCSVContext;
	"file/mypagescraper-records-csv": EmptyObject;
	"file/mypagescraper-player-csv": EmptyObject;
	"file/import-class": EmptyObject;

	"ir/direct-manual": BatchManualContext;
	"ir/barbatos": BarbatosContext;
	"ir/fervidex": FervidexContext;
	"ir/fervidex-static": FervidexStaticContext;
	"ir/beatoraja": BeatorajaContext;
	"ir/usc": IRUSCContext;
	"ir/kshook-sv6c": KsHookSV6CContext;
	"ir/kshook-sv6c-static": EmptyObject;
	"ir/lr2hook": LR2HookContext;

	"api/flo-iidx": KaiContext;
	"api/flo-sdvx": KaiContext;
	"api/min-sdvx": KaiContext;
	"api/eag-iidx": KaiContext;
	"api/eag-sdvx": KaiContext;
	"api/myt-chunithm": EmptyObject;
	"api/myt-maimaidx": EmptyObject;
	"api/myt-ongeki": EmptyObject;
	"api/myt-wacca": EmptyObject;

	"api/cg-dev-jubeat": CGContext;
	"api/cg-dev-sdvx": CGContext;
	"api/cg-dev-museca": CGContext;
	"api/cg-dev-popn": CGContext;
	"api/cg-nag-jubeat": CGContext;
	"api/cg-nag-sdvx": CGContext;
	"api/cg-nag-museca": CGContext;
	"api/cg-nag-popn": CGContext;
	"api/cg-gan-jubeat": CGContext;
	"api/cg-gan-sdvx": CGContext;
	"api/cg-gan-museca": CGContext;
	"api/cg-gan-popn": CGContext;
}

export interface OrphanScoreDocument<T extends ImportTypes = ImportTypes> {
	importType: T;
	data: ImportTypeDataMap[T];
	context: ImportTypeContextMap[T];
	errMsg: string | null;
	orphanID: string;
	userID: integer;
	timeInserted: number;
	game: GameGroup;
}

export interface ConverterFnSuccessReturn {
	dryScore: DryScore;
	chart: ChartDocument;
	song: SongDocument;
}

export type ConverterFnReturnOrFailure = ConverterFailure | ConverterFnSuccessReturn;

export type ConverterFunction<D, C> = (
	data: D,
	processContext: C,
	importType: ImportTypes,
	log: KtLogger,
) => Promise<ConverterFnSuccessReturn>;

export type ImportInputParser<D, C, TGame extends V3Game> = (
	log: KtLogger,
) => ParserFunctionReturns<D, C, TGame> | Promise<ParserFunctionReturns<D, C, TGame>>;

export interface ParserFunctionReturns<D, C, TGame extends V3Game> {
	iterable: AsyncIterable<D> | Iterable<D>;
	context: C;
	gameGroup: GameGroupFromGame[TGame];
	classProvider: ClassProvider<TGame> | null;
	service: string;
}

export type ParserFunction<D, C, TGame extends V3Game, A extends Array<unknown>> = (
	...args: A
) => ParserFunctionReturns<D, C, TGame> | Promise<ParserFunctionReturns<D, C, TGame>>;
