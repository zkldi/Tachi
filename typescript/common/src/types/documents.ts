import type {
	AnyClasses,
	ChartDocumentData,
	Classes,
	Difficulties,
	ExtractedClasses,
	GameGroup,
	GameGroupFromGame,
	integer,
	Judgements,
	LEGACY_GPTStringToGameGroup,
	MongoDerivedMetrics,
	MongoOptionalMetrics,
	MongoProvidedMetrics,
	OptionalEnumIndexes,
	PgDerivedMetrics,
	PgOptionalMetrics,
	PgProvidedMetrics,
	Preferences,
	ProfileRatingAlgorithms,
	ScoreEnumIndexes,
	ScoreMeta,
	ScoreRatingAlgorithms,
	SessionRatingAlgorithms,
	SongDocumentData,
	UserAuthLevels,
	V3Game,
	V3GameToGPTString,
	Versions,
} from "../types";
import type { APIPermissions } from "./api";
import type { ImportTypes } from "./import-types";
import type { BaseNotification, NotificationBody } from "./notifications";

export interface IObjectID {
	readonly toHexString: () => string;
	readonly toString: () => string;
}

export interface BaseGoalDocument<TGame extends V3Game = V3Game> {
	game: TGame;
	name: string;
	goalID: string;
	criteria: GoalCountCriteria<TGame> | GoalSingleCriteria<TGame>;
}

interface GoalCriteria<_TGame extends V3Game = V3Game> {
	// vvv this basically doesn't work as it starts thinking this might be a symbol
	// causing a myriad of annoying errors.
	// key: keyof DerivedMetrics[GPT] | keyof ProvidedMetrics[GPT];

	// doing this silly hack instead.
	key: string;

	value: number;
}

export interface GoalSingleCriteria<TGame extends V3Game = V3Game> extends GoalCriteria<TGame> {
	mode: "single";
}

/**
 * Criteria for a score to match this criteria - this is a "count" mode, which means that
 * at least N scores have to match this criteria. This is for things like folders.
 */
export interface GoalCountCriteria<TGame extends V3Game = V3Game> extends GoalCriteria<TGame> {
	mode: "absolute" | "proportion";
	countNum: number;
}

/**
 * Goal Document - Single. A goal document that is only for one specific chart.
 */
export interface GoalDocumentSingle<TGame extends V3Game = V3Game> extends BaseGoalDocument<TGame> {
	charts: {
		data: string;
		type: "single";
	};
}

/**
 * Goal Document - Multi. A goal document whos set of charts is the array of
 * chartIDs inside "charts".
 */
export interface GoalDocumentMulti<TGame extends V3Game = V3Game> extends BaseGoalDocument<TGame> {
	charts: {
		data: Array<string>;
		type: "multi";
	};
}

/**
 * Goal Document - Folder. A goal document whos set of charts is derived from
 * the folderID inside "charts".
 */
export interface GoalDocumentFolder<TGame extends V3Game = V3Game> extends BaseGoalDocument<TGame> {
	charts: {
		/** Internal Postgres `folder.id`; goal validation and storage use this. */
		data: string;
		/** Set on API responses so clients can link with {@link BaseFolderDocument.slug}. */
		folderSlug?: string;
		type: "folder";
	};
}

export type GoalDocument<TGame extends V3Game = V3Game> =
	| GoalDocumentFolder<TGame>
	| GoalDocumentMulti<TGame>
	| GoalDocumentSingle<TGame>;

interface BaseInviteCodeDocument {
	createdBy: integer;
	code: string;
	createdAt: number;
}

export type InviteCodeDocument = (
	| { consumed: false; consumedAt: null; consumedBy: null }
	| { consumed: true; consumedAt: number; consumedBy: integer }
) &
	BaseInviteCodeDocument;

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

export interface SessionDocument<TGame extends V3Game = V3Game> {
	userID: integer;
	sessionID: string;
	scoreIDs: Array<string>;
	name: string;
	desc: string | null;
	game: V3Game;

	timeInserted: integer;
	timeEnded: integer;
	timeStarted: integer;
	calculatedData: Partial<Record<SessionRatingAlgorithms[TGame], number | null>>;
	highlight: boolean;
}

/** One entry in {@link ImportDocument.errors} for a failed datapoint during import. */
export interface ImportErrContent {
	type: string;
	message: string;
	/** Set when this row was persisted as `orphan_score` (SongOrChartNotFound / OrphanExists). */
	orphanID?: string;
}

export interface ImportDocument {
	userID: integer;
	timeStarted: number;
	timeFinished: number;

	gameGroup: GameGroup;
	// What games were involved in this import.
	// this is just a subset of the games available in the gameGroup above
	// the logic around whether imports can have more than one gameGroup is - uh - muddled
	// at best.
	games: Array<V3Game>;

	importID: string;
	scoreIDs: Array<string>;
	errors: Array<ImportErrContent>;

	// TODO(zk): Incoherent and wrong comment
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
	game: V3Game;
	goalID: string;
	lastInteraction: integer | null;
	outOf: number;
	outOfHuman: string;
	progress: number | null;
	progressHuman: string;
	userID: integer;
	// Was this goal assigned "standalone"? I.e. a user explicitly subscribed to this.
	// instead of it being a result of a quest subscription.
	wasAssignedStandalone: boolean;
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
	game: V3Game;
	name: string;
	desc: string;
	questData: Array<QuestSection>;
	questID: string;
}

export interface QuestlineDocument {
	questlineID: string;
	name: string;
	desc: string;
	game: V3Game;
	quests: Array<string>;
}

export type UserBadges = "alpha" | "beta" | "contributor" | "dev-team" | "significant-contributor";

export interface UserDocument {
	username: string;
	usernameLowercase: string;
	id: integer;
	socialMedia: {
		discord?: string | null;
		github?: string | null;
		steam?: string | null;
		twitch?: string | null;
		twitter?: string | null;
		youtube?: string | null;
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
	canSubmitQuests?: boolean;
	canImportProvidedClass?: boolean;
}

export interface SpecificUserGameStats<TGame extends V3Game> {
	userID: integer;
	game: V3Game;
	ratings: Partial<Record<ProfileRatingAlgorithms[TGame], number | null>>;
	classes: Partial<ExtractedClasses[TGame]>;
}

/**
 * GPT agnostic stats for a game. This type is easier to work with than the
 * specificUserGameStats one for general cases.
 */
export interface UserGameStats {
	userID: integer;
	game: V3Game;
	ratings: Partial<Record<ProfileRatingAlgorithms[V3Game], number | null>>;
	classes: AnyClasses;
}

/** `GET /games/:game/leaderboard` and `.../leaderboard-adjacent` (tie-aware profile rating rank). */
export type UserGameStatsWithProfileLeaderboardRank = {
	rank: integer;
} & UserGameStats;

export interface ChartTierlistInfo {
	text: string;
	value: number;
	individualDifference?: boolean;
}

export interface ChartDocument<TGame extends V3Game = V3Game> {
	game: TGame;
	chartID: string;
	/** Mongo-era 40-character chart identifier; used for score deduplication. */
	legacyChartID: string;
	level: string;
	levelNum: number;
	isPrimary: boolean;
	difficulty: Difficulties[TGame];
	data: ChartDocumentData[TGame];
	versions: Array<Versions[TGame]>;
	song: SongDocument<GameGroupFromGame[TGame]>;
}

export interface SongDocument<G extends GameGroup = GameGroup> {
	id: string;
	title: string;
	artist: string;
	searchTerms: Array<string>;
	altTitles: Array<string>;
	data: SongDocumentData[G];
}

export interface TableDocument {
	tableID: string;
	game: V3Game;
	title: string;
	description: string;
	folders: Array<string>;
	inactive: boolean;
	default: boolean;
}

export interface BaseFolderDocument {
	folderID: string;
	slug: string;
	title: string;
	game: V3Game;

	/**
	 * This folder has been superceded by another folder,
	 * such as one on a more modern version of the game.
	 */
	inactive: boolean;
	searchTerms: Array<string>;
}

export type FolderDocument = BaseFolderDocument;

export interface FolderChartLookup {
	chartID: string;
	folderID: string;
}

export type QuestSubscriptionDocument = {
	game: V3Game;
	lastInteraction: integer | null;
	progress: integer;
	questID: string;
	userID: integer;
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

export type PgScoreData<Game extends V3Game = V3Game> = {
	data: PgScoreProvidedData<Game>;
	derived: PgScoreDerivedData<Game>;
	judgements: PgScoreJudgements<Game>;
};

export type PgScoreProvidedData<TGame extends V3Game = V3Game> = PgOptionalMetrics[TGame] &
	PgProvidedMetrics[TGame];

export type PgScoreDerivedData<TGame extends V3Game = V3Game> = PgDerivedMetrics[TGame];

export type PgScoreJudgements<TGame extends V3Game = V3Game> = Partial<
	Record<Judgements[TGame], integer | null>
>;

export type ScoreData<TGame extends V3Game = V3Game> = {
	enumIndexes: ScoreEnumIndexes<TGame>;
	judgements: Partial<Record<Judgements[TGame], integer | null>>;
	optional: {
		enumIndexes: OptionalEnumIndexes<TGame>;
	} & MongoOptionalMetrics[TGame];
} & MongoDerivedMetrics[TGame] &
	MongoProvidedMetrics[TGame];

export interface ScoreDocument<TGame extends V3Game = V3Game> {
	service: string;
	game: TGame;
	userID: integer;
	scoreData: ScoreData<TGame>;
	scoreMeta: Partial<ScoreMeta[TGame]>;
	calculatedData: Partial<Record<ScoreRatingAlgorithms[TGame], number | null>>;
	timeAchieved: integer | null;
	songID: string;
	chartID: string;
	isPrimary: boolean;
	highlight: boolean;
	comment: string | null;
	timeAdded: integer;
	scoreID: string;
	/** Present when this score was imported or logged as part of a session. */
	sessionID: string | null;
	importType: ImportTypes | null;
}

export interface PBReference {
	name: string;
	scoreID: string;
}

export interface PBScoreDocument<TGame extends V3Game = V3Game> {
	// guaranteed to at least have one element.
	composedFrom: [PBReference, ...Array<PBReference>];
	rankingData: {
		outOf: integer;
		rank: integer;

		// out of their rivals, what is their position on this chart?
		// note that we don't need to store rivalOutOf, as it's pretty much a constant
		// that can just be read from the UGPT settings.
		// null if the user has no rivals.
		rivalRank: integer | null;
	};
	userID: integer;
	chartID: string;
	game: TGame;
	songID: string;
	highlight: boolean;
	isPrimary: boolean;
	timeAchieved: number | null;
	scoreData: ScoreData<TGame>;
	calculatedData: Partial<Record<ScoreRatingAlgorithms[TGame], number | null>>;
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

export interface ImportProcessInfoScoreImported<TGame extends V3Game = V3Game> {
	success: true;
	type: "ScoreImported";
	message: string;
	content: {
		score: ScoreDocument<TGame>;
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
		context: unknown;
		// these are too complex to type. Not bothering.
		data: unknown;
		orphanID: string;
	};
}

export type ImportProcessingInfo<TGame extends V3Game = V3Game> =
	| ImportProcessInfoAmbiguousTitle
	| ImportProcessInfoInternalError
	| ImportProcessInfoInvalidDatapoint
	| ImportProcessInfoOrphanExists
	| ImportProcessInfoScoreImported<TGame>
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

interface BMSCourseInner<TGame extends V3Game, Set extends keyof ExtractedClasses[TGame]> {
	set: Set;
	game: TGame;
	value: ExtractedClasses[TGame][Set];
}

/**
 * Used to resolve beatoraja IR courses.
 */
export interface BMSCourseDocument
	extends BMSCourseInner<
		"bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard",
		keyof ExtractedClasses["bms-7k" | "bms-14k" | "pms-controller" | "pms-keyboard"]
	> {
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

export type ShowcaseStatDetails = ShowcaseStatChart | ShowcaseStatFolder;

export interface ShowcaseStatFolder {
	mode: "folder";
	// TODO(zk): This should be folderID, not slug
	/** {@link BaseFolderDocument.slug} for this game. */
	slug: string;

	// should be a valid metric for the showcase this game is for
	// this is not checked by the typesystem though. sorry!
	metric: string;
	gte: number;
}

export interface ShowcaseStatChart {
	mode: "chart";
	chartID: string;
}

export interface UGPTSettingsDocument<TGame extends V3Game = V3Game> {
	userID: integer;
	game: TGame;
	preferences: {
		defaultTable: string | null;
		gameSpecific: Preferences[TGame];
		preferredDefaultEnum: string | null;
		preferredProfileAlg: ProfileRatingAlgorithms[TGame] | null;
		preferredRanking: "global" | "rival" | null;
		preferredScoreAlg: ScoreRatingAlgorithms[TGame] | null;
		preferredSessionAlg: SessionRatingAlgorithms[TGame] | null;
		stats: Array<ShowcaseStatDetails>;
	};
	rivals: Array<integer>;
}

export interface UserGameStatsSnapshotDocument<TGame extends V3Game = V3Game>
	extends SpecificUserGameStats<TGame> {
	rankings: Record<ProfileRatingAlgorithms[TGame], { outOf: integer; ranking: integer | null }>;
	playcount: integer;
	timestamp: integer;
}

export interface UserSettingsDocument {
	userID: integer;
	following: Array<integer>;
	preferences: {
		advancedMode: boolean;
		contentiousContent: boolean;
		deletableScores: boolean;
		developerMode: boolean;
		invisible: boolean;
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

export interface OrphanChartDocument<TGame extends V3Game = V3Game> {
	game: TGame;
	chartDoc: ChartDocument<TGame>;
	songDoc: SongDocument<LEGACY_GPTStringToGameGroup[V3GameToGPTString[TGame]]>;
	userIDs: Array<integer>;
}

export interface ClassDelta {
	game: V3Game;
	set: Classes[V3Game];
	old: string | null;
	new: string;
}

export type ClassAchievementSource = "import" | "manual";

export interface ClassAchievementDocument<TGame extends V3Game = V3Game> {
	game: TGame;
	classSet: Classes[TGame];
	classOldValue: string | null;
	classValue: string;
	timeAchieved: number;
	userID: integer;
	source?: ClassAchievementSource;
}

export interface RecentlyViewedFolderDocument {
	userID: integer;
	game: V3Game;
	// TODO(zk): should be folderID
	/** Folder {@link BaseFolderDocument.slug} for this game. */
	slug: string;
	lastViewed: number;
}

export type NotificationDocument = {
	body: NotificationBody;
} & BaseNotification;

export interface ChallengeSubscriptionDocument {
	chartID: string;
	authorID: integer;
	type: "lamp" | "score";
	game: V3Game;
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
