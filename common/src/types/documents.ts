import type {
	AnyClasses,
	ChartDocumentData,
	Classes,
	DerivedMetrics,
	Difficulties,
	ExtractedClasses,
	GPTString,
	GPTStringToGame,
	GPTStringToPlaytype,
	GPTStrings,
	Game,
	Judgements,
	OptionalEnumIndexes,
	OptionalMetrics,
	Playtype,
	Playtypes,
	Preferences,
	ProfileRatingAlgorithms,
	ProvidedMetrics,
	ScoreEnumIndexes,
	ScoreMeta,
	ScoreRatingAlgorithms,
	SessionRatingAlgorithms,
	SongDocumentData,
	UserAuthLevels,
	Versions,
	integer,
} from "../types";
import type { APIPermissions } from "./api";
import type { ImportTypes } from "./import-types";
import type { BaseNotification, NotificationBody } from "./notifications";
import type { FilterQuery } from "mongodb";

export interface IObjectID {
	readonly toHexString: () => string;
	readonly toString: () => string;
}

export interface CounterDocument {
	counterName: string;
	value: integer;
}

export interface ChartFolderLookupDocument {
	chartID: string;
	folderID: string;
}

export interface BaseGoalDocument<GPT extends GPTString> {
	game: Game;
	playtype: Playtype;
	name: string;
	goalID: string;
	criteria: GoalCountCriteria<GPT> | GoalSingleCriteria<GPT>;
}

interface GoalCriteria<GPT extends GPTString> {
	// vvv this basically doesn't work as it starts thinking this might be a symbol
	// causing a myriad of annoying errors.
	// key: keyof DerivedMetrics[GPT] | keyof ProvidedMetrics[GPT];

	// doing this silly hack instead.
	key: string;

	value: number;
}

export interface GoalSingleCriteria<GPT extends GPTString> extends GoalCriteria<GPT> {
	mode: "single";
}

/**
 * Criteria for a score to match this criteria - this is a "count" mode, which means that
 * atleast N scores have to match this criteria. This is for things like folders.
 */
export interface GoalCountCriteria<GPT extends GPTString> extends GoalCriteria<GPT> {
	mode: "absolute" | "proportion";
	countNum: number;
}

/**
 * Goal Document - Single. A goal document that is only for one specific chart.
 */
export interface GoalDocumentSingle<GPT extends GPTString = GPTString>
	extends BaseGoalDocument<GPT> {
	charts: {
		type: "single";
		data: string;
	};
}

/**
 * Goal Document - Multi. A goal document whos set of charts is the array of
 * chartIDs inside "charts".
 */
export interface GoalDocumentMulti<GPT extends GPTString = GPTString>
	extends BaseGoalDocument<GPT> {
	charts: {
		type: "multi";
		data: Array<string>;
	};
}

/**
 * Goal Document - Folder. A goal document whos set of charts is derived from
 * the folderID inside "charts".
 */
export interface GoalDocumentFolder<GPT extends GPTString = GPTString>
	extends BaseGoalDocument<GPT> {
	charts: {
		type: "folder";
		data: string;
	};
}

export type GoalDocument<GPT extends GPTString = GPTString> =
	| GoalDocumentFolder<GPT>
	| GoalDocumentMulti<GPT>
	| GoalDocumentSingle<GPT>;

interface BaseInviteCodeDocument {
	createdBy: integer;
	code: string;
	createdAt: number;
}

export type InviteCodeDocument = BaseInviteCodeDocument &
	(
		| { consumed: false; consumedBy: null; consumedAt: null }
		| { consumed: true; consumedBy: integer; consumedAt: number }
	);

export interface SessionInfoReturn {
	sessionID: string;
	type: "Appended" | "Created";
}

interface SessionScorePBInfo {
	scoreID: string;
	isNewScore: false;

	// metric -> difference between previous PB.
	deltas: Record<string, number>;
}

interface SessionScoreNewInfo {
	scoreID: string;
	isNewScore: true;
}

export type SessionScoreInfo = SessionScoreNewInfo | SessionScorePBInfo;

export interface SessionDocument<GPT extends GPTString = GPTString> {
	userID: integer;
	sessionID: string;
	scoreIDs: Array<string>;
	name: string;
	desc: string | null;
	game: Game;
	playtype: Playtype;

	timeInserted: integer;
	timeEnded: integer;
	timeStarted: integer;
	calculatedData: Partial<Record<SessionRatingAlgorithms[GPT], number | null>>;
	highlight: boolean;
}

interface ImportErrContent {
	type: string;
	message: string;
}

export interface ImportDocument {
	userID: integer;
	timeStarted: number;
	timeFinished: number;

	// Contains an array of GPTString, which dictates what (game:playtype)s were involved in this import.
	gptStrings: Array<GPTString>;
	importID: string;
	scoreIDs: Array<string>;
	game: Game;
	playtypes: Array<Playtypes[Game]>;
	errors: Array<ImportErrContent>;

	// For performance reasons, imports only show what sessions they created, rather than what sessions they didn't.
	// This is just an array of sessionIDs, to keep things normalised. May be empty.
	createdSessions: Array<SessionInfoReturn>;
	importType: ImportTypes;
	classDeltas: Array<ClassDelta>;
	goalInfo: Array<GoalImportInfo>;
	questInfo: Array<QuestImportInfo>;

	/**
	 * Whether the user deliberately imported this through an action (i.e. uploaded a file personally) [true]
	 * or was imported on their behalf through a service (i.e. fervidex)
	 */
	userIntent: boolean;
}

export interface ImportTimingsDocument {
	importID: string;
	timestamp: number;
	total: number;

	/**
	 * Relative times - these are the times for each section
	 * divided by how much data they had to process.
	 */
	rel: Omit<ImportTimingSections, "goal" | "parse" | "quest" | "ugs">;

	/**
	 * Absolute times - these are the times for each section.
	 */
	abs: ImportTimingSections;
}

interface ImportTimingSections {
	parse: number;
	import: number;
	importParse: number;
	session: number;
	pb: number;
	ugs: number;
	goal: number;
	quest: number;
}

export type GoalImportStat = Pick<
	GoalSubscriptionDocument,
	"achieved" | "outOf" | "outOfHuman" | "progress" | "progressHuman"
>;

export interface GoalImportInfo {
	goalID: string;
	old: GoalImportStat;
	new: GoalImportStat;
}

export type QuestImportStat = Pick<QuestSubscriptionDocument, "achieved" | "progress">;

export interface QuestImportInfo {
	questID: string;
	old: QuestImportStat;
	new: QuestImportStat;
}

export type GoalSubscriptionDocument = {
	goalID: string;
	userID: integer;
	game: Game;
	playtype: Playtype;
	lastInteraction: integer | null;
	progress: number | null;
	progressHuman: string;
	outOf: number;
	outOfHuman: string;
	wasInstantlyAchieved: boolean;

	// Was this goal assigned "standalone"? I.e. a user explicitly subscribed to this.
	// instead of it being a result of a quest subscription.
	wasAssignedStandalone: boolean;
} & (
	| {
			achieved: false;
			timeAchieved: null;
	  }
	| {
			achieved: true;
			timeAchieved: integer;
	  }
);

export interface QuestGoalReference {
	goalID: string;
	note?: string;
}

export interface QuestSection {
	title: string;
	desc?: string;
	goals: Array<QuestGoalReference>;
}

export interface QuestDocument {
	game: Game;
	playtype: Playtype;
	name: string;
	desc: string;
	questData: Array<QuestSection>;
	questID: string;
}

export interface QuestlineDocument {
	questlineID: string;
	name: string;
	desc: string;
	game: Game;
	playtype: Playtype;
	quests: Array<string>;
}

export type UserBadges = "alpha" | "beta" | "contributor" | "dev-team" | "significant-contributor";

export interface UserDocument {
	username: string;
	usernameLowercase: string;
	id: integer;
	socialMedia: {
		discord?: string | null;
		twitter?: string | null;
		github?: string | null;
		steam?: string | null;
		youtube?: string | null;
		twitch?: string | null;
	};
	joinDate: integer;
	lastSeen: integer;
	about: string;
	status: string | null;
	customPfpLocation: string | null;
	customBannerLocation: string | null;
	badges: Array<UserBadges>;
	authLevel: UserAuthLevels;
	isSupporter?: boolean;
}

export interface SpecificUserGameStats<GPT extends GPTString> {
	userID: integer;
	game: GPTStringToGame[GPT];
	playtype: GPTStringToPlaytype[GPT];
	ratings: Partial<Record<ProfileRatingAlgorithms[GPT], number | null>>;
	classes: Partial<ExtractedClasses[GPT]>;
}

/**
 * GPT agnostic stats for a game. This type is easier to work with than the
 * specificUserGameStats one for general cases.
 */
export interface UserGameStats {
	userID: integer;
	game: Game;
	playtype: Playtype;
	ratings: Partial<Record<ProfileRatingAlgorithms[GPTString], number | null>>;
	classes: AnyClasses;
}

export interface ChartTierlistInfo {
	text: string;
	value: number;
	individualDifference?: boolean;
}

export interface ChartDocument<GPT extends GPTString = GPTString> {
	chartID: string;
	songID: integer;
	level: string;
	levelNum: number;
	isPrimary: boolean;
	difficulty: Difficulties[GPT];
	playtype: GPTStringToPlaytype[GPT];
	data: ChartDocumentData[GPT];
	versions: Array<Versions[GPT]>;
}

export interface SongDocument<G extends Game = Game> {
	id: integer;
	title: string;
	artist: string;
	searchTerms: Array<string>;
	altTitles: Array<string>;
	data: SongDocumentData[G];
}

export interface TableDocument {
	tableID: string;
	game: Game;
	playtype: Playtype;
	title: string;
	description: string;
	folders: Array<string>;
	inactive: boolean;
	default: boolean;
}

export interface BaseFolderDocument {
	title: string;
	game: Game;
	playtype: Playtype;
	folderID: string;

	/**
	 * This folder has been superceded by another folder,
	 * such as one on a more modern version of the game.
	 */
	inactive: boolean;
	searchTerms: Array<string>;
}

export interface FolderSongsDocument extends BaseFolderDocument {
	type: "songs";
	data: FilterQuery<SongDocument>;
}

export interface FolderChartsDocument extends BaseFolderDocument {
	type: "charts";
	data: FilterQuery<ChartDocument>;
}

export interface FolderStaticDocument extends BaseFolderDocument {
	type: "static";
	data: Array<string>;
}

export type FolderDocument = FolderChartsDocument | FolderSongsDocument | FolderStaticDocument;

export interface FolderChartLookup {
	chartID: string;
	folderID: string;
}

export type QuestSubscriptionDocument = {
	questID: string;
	userID: integer;
	game: Game;
	playtype: Playtype;
	progress: integer;
	lastInteraction: integer | null;
	wasInstantlyAchieved: boolean;
} & (
	| {
			achieved: false;
			timeAchieved: null;
	  }
	| {
			achieved: true;
			timeAchieved: integer;
	  }
);

export type ScoreData<GPT extends GPTString = GPTString> = DerivedMetrics[GPT] &
	ProvidedMetrics[GPT] & {
		judgements: Partial<Record<Judgements[GPT], integer | null>>;
		optional: OptionalMetrics[GPT] & {
			enumIndexes: OptionalEnumIndexes<GPT>;
		};
		enumIndexes: ScoreEnumIndexes<GPT>;
	};

export interface ScoreDocument<GPT extends GPTString = GPTString> {
	service: string;
	game: GPTStringToGame[GPT];
	playtype: GPTStringToPlaytype[GPT];
	userID: integer;
	scoreData: ScoreData<GPT>;
	scoreMeta: Partial<ScoreMeta[GPT]>;
	calculatedData: Partial<Record<ScoreRatingAlgorithms[GPT], number | null>>;
	timeAchieved: integer | null;
	songID: integer;
	chartID: string;
	isPrimary: boolean;
	highlight: boolean;
	comment: string | null;
	timeAdded: integer;
	scoreID: string;
	importType: ImportTypes | null;
}

export interface PBReference {
	name: string;
	scoreID: string;
}

export interface PBScoreDocument<GPT extends GPTString = GPTString> {
	// guaranteed to atleast have one element.
	composedFrom: [PBReference, ...Array<PBReference>];
	rankingData: {
		rank: integer;
		outOf: integer;

		// out of their rivals, what is their position on this chart?
		// note that we don't need to store rivalOutOf, as it's pretty much a constant
		// that can just be read from the UGPT settings.
		// null if the user has no rivals.
		rivalRank: integer | null;
	};
	userID: integer;
	chartID: string;
	game: Game;
	playtype: Playtype;
	songID: integer;
	highlight: boolean;
	isPrimary: boolean;
	timeAchieved: number | null;
	scoreData: ScoreData<GPT>;
	calculatedData: Partial<Record<ScoreRatingAlgorithms[GPT], number | null>>;
}

export interface ImportProcessInfoOrphanExists {
	success: false;
	type: "OrphanExists";
	message: string;
	content: {
		orphanID: string;
	};
}

export interface ImportProcessInfoInvalidDatapoint {
	success: false;
	type: "InvalidDatapoint";
	message: string;
	content: Record<string, never>;
}

export interface ImportProcessInfoAmbiguousTitle {
	success: false;
	type: "AmbiguousTitle";
	message: string;
	content: {
		title: string;
	};
}

export interface ImportProcessInfoScoreImported<GPT extends GPTString = GPTString> {
	success: true;
	type: "ScoreImported";
	message: string;
	content: {
		score: ScoreDocument<GPT>;
	};
}

export interface ImportProcessInfoInternalError {
	success: false;
	type: "InternalError";
	message: string;
	content: Record<string, never>;
}

export interface ImportProcessInfoSongOrChartNotFound {
	success: false;
	type: "SongOrChartNotFound";
	message: string;
	content: {
		// these are too complex to type. Not bothering.
		data: unknown;
		context: unknown;
		orphanID: string;
	};
}

export type ImportProcessingInfo<GPT extends GPTString = GPTString> =
	| ImportProcessInfoAmbiguousTitle
	| ImportProcessInfoInternalError
	| ImportProcessInfoInvalidDatapoint
	| ImportProcessInfoOrphanExists
	| ImportProcessInfoScoreImported<GPT>
	| ImportProcessInfoSongOrChartNotFound;

export interface ImportStatistics {
	scoreCount: integer;
	msPerScore: number;
	sessionCount: integer;
	msPerSession: number;
	ratingTime: number;
	importID: string;
}

export interface KaiAuthDocument {
	userID: integer;
	token: string;
	refreshToken: string;
	service: "EAG" | "FLO" | "MIN";
}

export interface CGCardInfo {
	userID: integer;
	service: "dev" | "gan" | "nag";
	cardID: string;

	// are we gonna do maths on it? no. it's a string. don't bother me.
	pin: string;
}

export interface MytCardInfo {
	userID: integer;
	cardAccessCode: string; // matches /^[0-9]{20}$/
}

interface BMSCourseInner<GPT extends GPTStrings["bms"], Set extends keyof ExtractedClasses[GPT]> {
	set: Set;
	playtype: GPTStringToPlaytype[GPT];
	value: ExtractedClasses[GPT][Set];
}

/**
 * Used to resolve beatoraja IR courses.
 */
export interface BMSCourseDocument
	extends BMSCourseInner<GPTStrings["bms"], keyof ExtractedClasses[GPTStrings["bms"]]> {
	title: string;
	md5sums: string;
}

/**
 * Information about the API Token used to make this request.
 */
export interface APITokenDocument {
	userID: integer | null;
	token: string | null;
	identifier: string;
	permissions: Partial<Record<APIPermissions, boolean>>;

	// API Tokens may be created as a result of a Tachi Client flow. This prop optionally
	// stores that.
	fromAPIClient: string | null;
}

export interface ImportLockDocument {
	userID: integer;
}

export type ShowcaseStatDetails = ShowcaseStatChart | ShowcaseStatFolder;

export interface ShowcaseStatFolder {
	mode: "folder";
	folderID: string;

	// should be a valid metric for the showcase this game is for
	// this is not checked by the typesystem though. sorry!
	metric: string;
	gte: number;
}

export interface ShowcaseStatChart {
	mode: "chart";
	chartID: string;

	// should be a valid metric for the showcase this game is for
	// this is not checked by the typesystem though. sorry!
	metric: string;
}

export interface UGPTSettingsDocument<GPT extends GPTString = GPTString> {
	userID: integer;
	game: GPTStringToGame[GPT];
	playtype: GPTStringToPlaytype[GPT];
	preferences: {
		preferredScoreAlg: ScoreRatingAlgorithms[GPT] | null;
		preferredSessionAlg: SessionRatingAlgorithms[GPT] | null;
		preferredProfileAlg: ProfileRatingAlgorithms[GPT] | null;
		stats: Array<ShowcaseStatDetails>;
		preferredDefaultEnum: string | null;
		defaultTable: string | null;
		preferredRanking: "global" | "rival" | null;
		gameSpecific: Preferences[GPT];
	};
	rivals: Array<integer>;
}

export interface UserGameStatsSnapshotDocument<GPT extends GPTString = GPTString>
	extends SpecificUserGameStats<GPT> {
	rankings: Record<ProfileRatingAlgorithms[GPT], { ranking: integer | null; outOf: integer }>;
	playcount: integer;
	timestamp: integer;
}

export interface UserSettingsDocument {
	userID: integer;
	following: Array<integer>;
	preferences: {
		invisible: boolean;
		developerMode: boolean;
		advancedMode: boolean;
		contentiousContent: boolean;
		deletableScores: boolean;
	};
}

export interface TachiAPIClientDocument {
	clientID: string;
	clientSecret: string;
	name: string;
	author: integer;
	requestedPermissions: Array<APIPermissions>;
	redirectUri: string | null;
	webhookUri: string | null;
	apiKeyTemplate: string | null;
	apiKeyFilename: string | null;
}

export interface FervidexSettingsDocument {
	userID: integer;
	cards: Array<string> | null;
	forceStaticImport: boolean;
}

export interface KsHookSettingsDocument {
	userID: integer;
	forceStaticImport: boolean;
}

export interface OrphanChartDocument<GPT extends GPTString = GPTString> {
	gptString: GPT;
	chartDoc: ChartDocument<GPT>;
	songDoc: SongDocument<GPTStringToGame[GPT]>;
	userIDs: Array<integer>;
}

export interface ClassDelta {
	game: Game;
	set: Classes[GPTString];
	playtype: Playtype;
	old: string | null;
	new: string;
}

export interface ClassAchievementDocument<GPT extends GPTString = GPTString> {
	game: GPTStringToGame[GPT];
	playtype: GPTStringToPlaytype[GPT];
	classSet: Classes[GPT];
	classOldValue: string | null;
	classValue: string;
	timeAchieved: number;
	userID: integer;
}

export interface RecentlyViewedFolderDocument {
	userID: integer;
	game: Game;
	playtype: Playtypes[Game];
	folderID: string;
	lastViewed: number;
}

export type NotificationDocument = BaseNotification & {
	body: NotificationBody;
};

export interface ChallengeSubscriptionDocument {
	chartID: string;
	authorID: integer;
	type: "lamp" | "score";

	game: Game;
	playtype: Playtype;

	userID: integer;
	achieved: boolean;
	achievedAt: number | null;
}

interface BaseImportTracker {
	timeStarted: number;
	importID: string;
	userID: integer;
	importType: ImportTypes;
	userIntent: boolean;
}

export interface ImportTrackerOngoing extends BaseImportTracker {
	type: "ONGOING";
}

export interface ImportTrackerFailed extends BaseImportTracker {
	type: "FAILED";
	error: { message: string; statusCode?: number };
}

/**
 * Tracks the status of an import while it goes through the pipeline or if it fails.
 *
 * Successful imports are removed from the tracking database, and their existence
 * is kept track of via { @see ImportDocument }.
 */
export type ImportTrackerDocument = ImportTrackerFailed | ImportTrackerOngoing;

export interface UserNameChangeDocument {
	userID: integer;
	username: string;
	timestamp: integer;
	previousUsername: string;
}
