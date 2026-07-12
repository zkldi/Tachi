import logger from "#logger";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

type MD5 = string;
type UserId = number;

const HALF_PI = Math.PI / 2;

function incrementMap<K>(map: Map<K, number>, key: K) {
	const value = map.get(key);

	if (value !== undefined) {
		map.set(key, value + 1);
	} else {
		map.set(key, 1);
	}
}

function sigmoid(x: number): number {
	return Math.atan(x * HALF_PI) / HALF_PI;
}

function dSigmoid(x: number): number {
	const y = Math.PI * x;

	return 4 / (4 + y * y);
}

export interface V1Score {
	md5: string;
	userID: number;
	clear: boolean;
}

export interface Computations {
	songPlaycount: Record<string, number>;
	userPlaycount: Record<string, number>;

	songDifficulty: Record<string, number>;
	userSkill: Record<string, number>;
}

export class DifficultyComputer {
	normalizedScores: Array<V1Score> = [];

	songDifficulty: Map<MD5, number> = new Map();
	songPlaycountMap: Map<MD5, number> = new Map();

	userPlaycountMap: Map<UserId, number> = new Map();
	userSkill: Map<UserId, number> = new Map();

	constructor(data: Array<V1Score>) {
		logger.info(`Reading ${data.length} data...`);

		const hasClearedAnyChart: Set<UserId> = new Set();
		const hasFailedAnyChart: Set<UserId> = new Set();

		for (const { userID, clear } of data) {
			if (clear) {
				hasClearedAnyChart.add(userID);
			} else {
				hasFailedAnyChart.add(userID);
			}
		}

		const excludedPlayers: Set<UserId> = new Set();

		for (const { md5, userID, clear } of data) {
			// Exclude players who have a 100% or 0% clear rate.
			if (hasClearedAnyChart.has(userID) !== hasFailedAnyChart.has(userID)) {
				excludedPlayers.add(userID);
				continue;
			}

			incrementMap(this.songPlaycountMap, md5);
			incrementMap(this.userPlaycountMap, userID);

			this.songDifficulty.set(md5, 0);
			this.userSkill.set(userID, 0);

			this.normalizedScores.push({ md5, userID, clear });
		}

		logger.warn(`${excludedPlayers.size} users ignored.`);

		logger.info(`Read ${this.songDifficulty.size} songs and ${this.userSkill.size} users.`);

		// Sorting MD5s alphabetically in our list of scores results in better
		// branch predictions when we iterate over the data.
		// Cool stuff!
		this.normalizedScores.sort((a, b) => a.md5.localeCompare(b.md5));
	}

	private _calculateStep(alpha: number): number {
		let maxDelta = 0;

		const deltaSongDifficulty: Map<MD5, number> = new Map();
		const deltaUserSkill: Map<UserId, number> = new Map();

		for (const songId of this.songDifficulty.keys()) {
			deltaSongDifficulty.set(songId, 0);
		}

		for (const userId of this.userSkill.keys()) {
			deltaUserSkill.set(userId, 0);
		}

		// bizarre optimisations
		// since this loop is painfully slow. We're trying to hit a juicy v8 hotpath.
		let lastMD5: string | null = null;

		// all of these 0 values are *fake*, and used to get typescript to shut up.
		let curSongDiff = 0;
		let curDeltaSDiff = 0;
		let curSongPlaycount = 0;

		let lastUserID: number | null = null;

		// Same as above, this is an optimisation, these are fake 0 values.
		let curUserSkill = 0;
		let curDeltaUSkill = 0;
		let curUserPlaycount = 0;

		for (const { md5, userID, clear } of this.normalizedScores) {
			if (lastMD5 !== md5) {
				curSongDiff = this.songDifficulty.get(md5)!;
				curSongPlaycount = this.songPlaycountMap.get(md5)!;

				lastMD5 = md5;
			}

			if (lastUserID !== userID) {
				curUserSkill = this.userSkill.get(userID)!;
				curUserPlaycount = this.userPlaycountMap.get(userID)!;

				lastUserID = userID;
			}

			curDeltaSDiff = deltaSongDifficulty.get(md5)!;
			curDeltaUSkill = deltaUserSkill.get(userID)!;

			const potent = curUserSkill - curSongDiff;
			const diff = (sigmoid(potent) - (clear ? 1 : -1)) * dSigmoid(potent);

			deltaSongDifficulty.set(md5, curDeltaSDiff + diff / curSongPlaycount);

			deltaUserSkill.set(userID, curDeltaUSkill - diff / curUserPlaycount);
		}

		for (const [songId, delta] of deltaSongDifficulty) {
			const newSongDifficulty = this.songDifficulty.get(songId)! + delta * alpha;

			this.songDifficulty.set(songId, newSongDifficulty);

			if (
				maxDelta === 0 ||
				(maxDelta > 0 && delta > maxDelta) ||
				(maxDelta < 0 && delta < maxDelta)
			) {
				maxDelta = delta;
			}
		}

		for (const [userId, delta] of deltaUserSkill) {
			const newUserSkill = this.userSkill.get(userId)! + delta * alpha;

			this.userSkill.set(userId, newUserSkill);

			if (
				maxDelta === 0 ||
				(maxDelta > 0 && delta > maxDelta) ||
				(maxDelta < 0 && delta < maxDelta)
			) {
				maxDelta = delta;
			}
		}

		return maxDelta;
	}

	computeDifficulty(tag: string) {
		const limit = 0.005;
		let alpha = 1;
		let maxDelta = 0;
		let lastMaxDelta = 0;

		let t = 0;

		do {
			logger.info(`Executing one step... (alpha = ${alpha})`);
			maxDelta = this._calculateStep(t < 20 ? 0.5 : alpha / 16) / Math.sqrt(alpha);

			logger.info(`Convergence at md = ${maxDelta}`);

			const isLMDPositive = lastMaxDelta > 0;
			const isMDPositive = maxDelta > 0;

			if (isLMDPositive === isMDPositive) {
				alpha = alpha * (alpha > 5 ? 1.005 : 1.02);
			} else {
				alpha = 1;
			}

			if (maxDelta === lastMaxDelta) {
				logger.warn(
					`NOT CONVERGING: Got in a one-cycle loop at ${maxDelta}. Returning anyway?`,
				);
				return;
			}

			lastMaxDelta = maxDelta;

			maxDelta = Math.abs(maxDelta);

			if (alpha * maxDelta > 1) {
				alpha = 1 / maxDelta;
			}

			t = t + 1;
		} while (maxDelta > limit);

		logger.info("Difficulties converged!");

		logger.info("Writing regression info...");

		mkdirSync(`${__dirname}/../../cache/v1-calc-regressions`, { recursive: true });
		writeFileSync(
			path.join(__dirname, `../../cache/v1-calc-regressions/${tag}.json`),
			JSON.stringify({
				songDifficulty: mapToObj(this.songDifficulty),
				userSkill: mapToObj(this.userSkill),
				songPlaycount: mapToObj(this.songPlaycountMap),
				userPlaycount: mapToObj(this.userPlaycountMap),
			}),
		);
	}

	loadExistingComputations(computations: Computations) {
		this.songPlaycountMap = new Map(Object.entries(computations.songPlaycount));
		this.songDifficulty = new Map(Object.entries(computations.songDifficulty));

		this.userPlaycountMap = new Map(
			Object.entries(computations.userPlaycount).map(([key, value]) => [Number(key), value]),
		);
		this.userSkill = new Map(
			Object.entries(computations.userSkill).map(([key, value]) => [Number(key), value]),
		);
	}
}

function mapToObj<K extends number | string, V>(map: Map<K, V>): Record<string, V> {
	return Object.fromEntries(map.entries());
}
