import type { TachiBMSTable } from "#lib/game-specific/custom-bms-tables";
import type {
	ChartDocument,
	FolderDocument,
	GameGroup,
	GoalDocument,
	GoalSubscriptionDocument,
	ImportDocument,
	integer,
	LEGACY_Playtype,
	QuestDocument,
	QuestlineDocument,
	QuestSubscriptionDocument,
	ScoreDocument,
	SessionDocument,
	SongDocument,
	TableDocument,
	TachiAPIClientDocument,
	UserDocument,
	UserGameStats,
	UserSettingsDocument,
	V3Game,
} from "tachi-common";

// Inject additional properties on express-session
declare module "express-session" {
	interface SessionData {
		tachi: TachiSessionData;
	}
}

declare module "express-serve-static-core" {
	export interface Request {
		// KNOWN BUG IN TS-ESLINT.
		/**
		 * This is a type-safe variant of "req.safeBody".
		 * "req.safeBody" is 'any' by default, which makes it exceptionally difficult
		 * to use in our codebase (due to the strict cadence rules.)
		 */
		safeBody: Record<string, unknown>;
	}
}

export interface TachiSessionData {
	user: UserDocument;
	settings: UserSettingsDocument;
}

export interface TachiAPIFailResponse {
	success: false;
	description: string;
}

export interface TachiAPISuccessResponse {
	success: true;
	description: string;
	body: Record<string, unknown>;
}

export type TachiAPIReponse = TachiAPIFailResponse | TachiAPISuccessResponse;

/**
 * Clarity type for empty objects - such as in context.
 */
export type EmptyObject = Record<string, never>;

/**
 * Data that may be monkey-patched onto req.tachi. This holds things such as middleware results.
 */
export interface TachiRequestData {
	uscChartDoc?: ChartDocument<"usc-controller" | "usc-keyboard">;

	beatorajaChartDoc?: ChartDocument<"bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard">;

	requestedUser?: UserDocument;
	requestedUserGameStats?: UserGameStats;
	gameGroup?: GameGroup;
	game?: V3Game;
	playtype?: LEGACY_Playtype;

	chartDoc?: ChartDocument;
	songDoc?: SongDocument;
	songNewID?: string;
	scoreDoc?: ScoreDocument;
	sessionDoc?: SessionDocument;
	tableDoc?: TableDocument;
	folderDoc?: FolderDocument;
	goalDoc?: GoalDocument;
	questDoc?: QuestDocument;
	goalSubDoc?: GoalSubscriptionDocument;
	questSubDoc?: QuestSubscriptionDocument;
	questlineDoc?: QuestlineDocument;
	importDoc?: ImportDocument;

	customBMSTable?: TachiBMSTable;

	apiClientDoc: Omit<TachiAPIClientDocument, "clientSecret">;
}

// This is only used on tachi-server, and isn't exposed -- so shouldn't be a part
// of common.
export interface PrivateUserInfoDocument {
	userID: integer;
	password: string;
	email: string;
}

export interface Migration {
	id: string;
	up: () => Promise<unknown>;
	down: () => Promise<unknown>;
}

export type MigrationDocument = {
	migrationID: string;
} & (
	| {
			appliedOn: integer;
			status: "applied";
	  }
	| {
			status: "pending";
	  }
);

// https://www.designcise.com/web/tutorial/how-to-change-readonly-properties-to-be-writable-in-typescript
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// https://stackoverflow.com/questions/61132262/typescript-deep-partial
export type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;
