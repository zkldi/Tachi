import { ONE_HOUR } from "#lib/constants/time";
import { LoadScoreDocumentById } from "#lib/db-formats/score";
import { LoadSessionDocumentById, SELECT_SESSION_DOCUMENT } from "#lib/db-formats/session";
import { AppendLogCtx, type KtLogger, log } from "#lib/log/log";
import DB from "#services/pg/db";
import { GetChartForIDGuaranteed } from "#utils/db";
import { UnixMillisecondsToISO8601 } from "#utils/time";
import crypto from "crypto";
import {
	GetGameConfig,
	GetScoreMetricConf,
	GetScoreMetrics,
	type integer,
	type ScoreDocument,
	type SessionDocument,
	type SessionInfoReturn,
	type SessionScoreInfo,
	type V3Game,
} from "tachi-common";

import type { ScoreGameMap } from "../common/types";

import { CreateSessionCalcData } from "../calculated-data/session";
import { CreatePBDoc, type PBScoreDocumentNoRank } from "../pb/create-pb-doc";
import { GenerateRandomSessionName } from "./name-generation";

const TWO_HOURS = ONE_HOUR * 2;

export async function CreateSessions(userID: integer, scoreGameMap: ScoreGameMap, log: KtLogger) {
	const allSessionInfo = [];

	for (const [game, scores] of Object.entries(scoreGameMap)) {
		// eslint-disable-next-line no-await-in-loop
		const sessionInfo = await LoadScoresIntoSessions(userID, scores, game as V3Game, log);

		allSessionInfo.push(...sessionInfo);
	}

	return allSessionInfo;
}

/**
 * Compares a score and the previous PB the user had and returns the difference
 * as a SessionScoreInfo object.
 */
function ScoreToSessionScoreInfo(
	score: ScoreDocument,
	previousPB: PBScoreDocumentNoRank | undefined,
): SessionScoreInfo {
	if (!previousPB) {
		return {
			scoreID: score.scoreID,
			isNewScore: true,
		};
	}

	const gameConfig = GetGameConfig(score.game);

	const deltas: Record<string, number> = {};

	const scoreMetrics = GetScoreMetrics(gameConfig, ["DECIMAL", "ENUM", "INTEGER"]);

	for (const metric of scoreMetrics) {
		const conf = GetScoreMetricConf(gameConfig, metric)!;

		if (conf.type === "ENUM") {
			deltas[metric] =
				// @ts-expect-error shush
				score.scoreData.enumIndexes[metric] - previousPB.scoreData.enumIndexes[metric];
		} else {
			// @ts-expect-error shush
			deltas[metric] = score.scoreData[metric] - previousPB.scoreData[metric];
		}
	}

	return {
		scoreID: score.scoreID,
		isNewScore: false,
		deltas,
	};
}

/**
 * Return info about how this session's scores stack up against the owner's PBs at the
 * time.
 */
export async function GetSessionScoreInfo(
	session: SessionDocument,
): Promise<Array<SessionScoreInfo>> {
	// TODO: Hard to implement efficiently
	// need to get the PB for this chart BEFORE the
	// given time T
	const scores = await DB.selectFrom("score")
		.select("score.id")
		.where("score.session_id", "=", session.sessionID)
		.execute();

	const scoreIds = scores.map((r) => r.id);

	const game = session.game;

	const promises = [];

	for (const sid of scoreIds) {
		promises.push(
			LoadScoreDocumentById(sid).then((scoreDoc) => {
				if (!scoreDoc) {
					return null;
				}

				return GetChartForIDGuaranteed(scoreDoc.chartID).then((chart) =>
					CreatePBDoc(game, session.userID, chart, log, session.timeStarted).then((pb) =>
						ScoreToSessionScoreInfo(scoreDoc, pb),
					),
				);
			}),
		);
	}

	const scoreInfo = (await Promise.all(promises)).filter(
		(e) => e !== null,
	) as Array<SessionScoreInfo>;

	return scoreInfo;
}

export function CreateSessionID() {
	return `Q${crypto.randomBytes(20).toString("hex")}`;
}

function UpdateExistingSession(
	existingSession: SessionDocument,
	newScoreIDs: Array<string>,
	oldScores: Array<ScoreDocument>,
	newScores: Array<ScoreDocument>,
) {
	const allScores = [...oldScores, ...newScores];

	const calculatedData = CreateSessionCalcData(existingSession.game, allScores);

	existingSession.calculatedData = calculatedData;
	existingSession.scoreIDs = [...existingSession.scoreIDs, ...newScoreIDs];

	if (newScores[0]!.timeAchieved! < existingSession.timeStarted) {
		existingSession.timeStarted = newScores[0]!.timeAchieved!;
	}

	if (newScores[newScores.length - 1]!.timeAchieved! > existingSession.timeEnded) {
		existingSession.timeEnded = newScores[newScores.length - 1]!.timeAchieved!;
	}

	return existingSession;
}

function CreateSession(
	userID: integer,
	scoreIDs: Array<string>,
	groupScores: Array<ScoreDocument>,
	game: V3Game,
): SessionDocument<V3Game> {
	const name = GenerateRandomSessionName();

	const calculatedData = CreateSessionCalcData(game, groupScores);

	return {
		userID,
		name,
		sessionID: CreateSessionID(),
		desc: null,
		game,
		highlight: false,
		scoreIDs,
		timeInserted: Date.now(),
		timeStarted: groupScores[0]!.timeAchieved!,
		timeEnded: groupScores[groupScores.length - 1]!.timeAchieved!,
		calculatedData,
	};
}

export async function LoadScoresIntoSessions(
	userID: integer,
	importScores: Array<ScoreDocument>,
	game: V3Game,
	baseLog: KtLogger,
): Promise<Array<SessionInfoReturn>> {
	const log = AppendLogCtx("Session Generation", baseLog);

	const timestampedScores = [];

	for (const score of importScores) {
		if (score.timeAchieved === null) {
			log.debug(`Ignored score ${score.scoreID}, as it had no timeAchieved.`);

			// ignore scores without timestamps. We can't use these for sessions.
			continue;
		}

		timestampedScores.push(score);
	}

	// If we have nothing to work with, why bother?
	if (timestampedScores.length === 0) {
		log.debug(`Skipped calculating sessions as there were no timestamped scores`);
		return [];
	}

	// sort scores ascendingly.
	timestampedScores.sort((a, b) => a.timeAchieved! - b.timeAchieved!);

	// The "Score Groups" for the array of scores provided.
	// This contains scores split on 2hr margins, which allows for more optimised
	// session db requests.
	const sessionScoreGroups: Array<Array<ScoreDocument>> = [];
	let curGroup: Array<ScoreDocument> = [];
	let lastTimestamp = 0;

	for (const score of timestampedScores) {
		if (score.timeAchieved! < lastTimestamp + TWO_HOURS) {
			curGroup.push(score);
		} else {
			sessionScoreGroups.push(curGroup);
			curGroup = [score];
		}

		lastTimestamp = score.timeAchieved!;
	}

	// There's no state here where curGroup is empty,
	// so push the group (which is guaranteed to have at least one score)
	sessionScoreGroups.push(curGroup);

	log.debug(`Created ${sessionScoreGroups.length} groups from timestamped scores.`);

	const sessionInfoReturns: Array<SessionInfoReturn> = [];

	// All async operations inside here *need* to be done in lockstep to avoid colliding sessions.
	// realistically, that shouldn't be possible, but hey.
	/* eslint-disable no-await-in-loop */
	for (const groupScores of sessionScoreGroups) {
		if (groupScores.length === 0) {
			continue;
		}

		const startOfGroup = groupScores[0]!.timeAchieved!;
		const endOfGroup = groupScores[groupScores.length - 1]!.timeAchieved!;

		const scoreIDs = groupScores.map((e) => e.scoreID);

		// Find any sessions with +/-2hrs of this group. This is rather exhaustive, and could result in some issues
		// if this query returns more than one session. We could account for that by smushing sessions together.
		// This is not possible however, so this is now just a known tachi oddity.
		const rangeStart = startOfGroup - TWO_HOURS;
		const rangeEnd = endOfGroup + TWO_HOURS;

		const nearbySession = await DB.selectFrom("session")
			.select(SELECT_SESSION_DOCUMENT)
			.where("session.user_id", "=", userID)
			.where("session.game", "=", game)
			.where((eb) =>
				eb.or([
					eb.and([
						eb("session.time_started", ">=", UnixMillisecondsToISO8601(rangeStart)),
						eb("session.time_started", "<", UnixMillisecondsToISO8601(rangeEnd)),
					]),
					eb.and([
						eb("session.time_ended", ">=", UnixMillisecondsToISO8601(rangeStart)),
						eb("session.time_ended", "<", UnixMillisecondsToISO8601(rangeEnd)),
					]),
				]),
			)
			.executeTakeFirst();

		let infoReturn: SessionInfoReturn;

		if (nearbySession) {
			log.debug(
				`Found nearby session for ${userID} (${game}) around ${startOfGroup} ${endOfGroup}.`,
			);

			const mongoSession = await LoadSessionDocumentById(nearbySession.id);

			if (!mongoSession) {
				log.error(`Session ${nearbySession.id} missing from LoadSessionDocumentById`);
				continue;
			}

			const oldScores = await loadScoresByIds(mongoSession.scoreIDs);

			const session = UpdateExistingSession(mongoSession, scoreIDs, oldScores, groupScores);

			infoReturn = { sessionID: session.sessionID, type: "Appended" };

			await DB.updateTable("session")
				.set({
					time_started: UnixMillisecondsToISO8601(session.timeStarted),
					time_ended: UnixMillisecondsToISO8601(session.timeEnded),
					calculated_data: JSON.stringify(session.calculatedData),
				})
				.where("id", "=", session.sessionID)
				.execute();

			await DB.updateTable("score")
				.set({ session_id: session.sessionID })
				.where("id", "in", scoreIDs)
				.execute();
		} else {
			log.debug(
				`Creating new session for ${userID} (${game}) around ${startOfGroup} ${endOfGroup}.`,
			);

			const session = CreateSession(userID, scoreIDs, groupScores, game);

			infoReturn = { sessionID: session.sessionID, type: "Created" };

			const now = UnixMillisecondsToISO8601(Date.now());

			await DB.insertInto("session")
				.values({
					id: session.sessionID,
					user_id: userID,
					game,
					name: session.name,
					description: session.desc,
					time_inserted: now,
					time_started: UnixMillisecondsToISO8601(session.timeStarted),
					time_ended: UnixMillisecondsToISO8601(session.timeEnded),
					calculated_data: JSON.stringify(session.calculatedData),
					highlight: session.highlight,
				})
				.execute();

			await DB.updateTable("score")
				.set({ session_id: session.sessionID })
				.where("id", "in", scoreIDs)
				.execute();
		}

		sessionInfoReturns.push(infoReturn);
	}
	/* eslint-enable no-await-in-loop */

	return sessionInfoReturns;
}

async function loadScoresByIds(ids: Array<string>): Promise<Array<ScoreDocument>> {
	if (ids.length === 0) {
		return [];
	}

	const out: Array<ScoreDocument> = [];

	for (const id of ids) {
		// eslint-disable-next-line no-await-in-loop
		const s = await LoadScoreDocumentById(id);

		if (s) {
			out.push(s);
		}
	}

	return out;
}
