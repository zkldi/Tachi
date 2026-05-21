import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";

import nodeFetch from "#utils/fetch";
import { IsRecord, staticAssertUnreachable } from "#utils/misc";
import { type GamesForGroup, IIDX_DANS } from "tachi-common";
import { IIDXDans } from "tachi-common/config/game-support/iidx";

import type { KaiAPIReauthFunction } from "../traverse-api";

import { KaiTypeToBaseURL } from "../utils";

export async function CreateKaiIIDXClassProvider(
	kaiType: "EAG" | "FLO",
	token: string,
	reauthFn: KaiAPIReauthFunction,
	fetch = nodeFetch,
): Promise<ClassProvider<GamesForGroup["iidx"]>> {
	let json: unknown;
	let err: unknown;
	const baseUrl = KaiTypeToBaseURL(kaiType);

	// SP and DP dans are located in the same place,
	// fetch once, then return a function that traverses this data.
	try {
		let res = await fetch(`${baseUrl}/api/iidx/v2/player_profile`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		// if we failed auth wise. Try reauthing.
		if (res.status === 401 || res.status === 403) {
			const newToken = await reauthFn();

			res = await fetch(`${baseUrl}/api/sdvx/v1/player_profile`, {
				headers: {
					Authorization: `Bearer ${newToken}`,
					"Content-Type": "application/json",
				},
			});
		}

		if (res.status !== 200) {
			const text = await res.text();

			throw new Error(`Got unexpected status from ${kaiType}: ${res.status}. Body: ${text}`);
		}

		json = (await res.json()) as unknown;
	} catch (e: unknown) {
		err = e;
	}

	return (game, _userID, _ratings, log) => {
		if (err !== undefined) {
			log.error({ err }, `An error occurred while updating classes for ${baseUrl}.`);
			return {};
		}

		if (!IsRecord(json)) {
			log.error(
				{
					json,
				},
				`JSON Returned from server was not an object? Not updating anything.`,
			);
			return {};
		}

		let maybeIIDXDan: unknown;

		switch (game) {
			case "iidx-sp":
				maybeIIDXDan = json.sp;
				break;
			case "iidx-dp":
				maybeIIDXDan = json.dp;
				break;
			default:
				staticAssertUnreachable(game);
		}

		if (
			maybeIIDXDan === null ||
			maybeIIDXDan === undefined ||
			typeof maybeIIDXDan !== "number"
		) {
			log.info(`User has no ${game} dan. Not updating anything.`);
			return {};
		}

		const iidxDan: number = maybeIIDXDan;

		if (!Number.isInteger(iidxDan)) {
			log.warn(`${baseUrl} returned a dan of ${iidxDan}, which was not a number.`);
			return {};
		}

		if (iidxDan > IIDX_DANS.KAIDEN) {
			log.warn(
				`${baseUrl} returned a dan of ${iidxDan}, which was greater than KAIDEN (${IIDX_DANS.KAIDEN}.)`,
			);
			return {};
		}

		if (iidxDan < IIDX_DANS.KYU_7) {
			log.warn(
				`${baseUrl} returned a dan of ${iidxDan}, which was less than KYU_7 (${IIDX_DANS.KYU_7}.)`,
			);
			return {};
		}

		const value = IIDXDans[iidxDan];

		if (!value) {
			log.warn(`${baseUrl} returned a dan of ${iidxDan}, which has no corresponding value.`);
			return {};
		}

		return {
			dan: value.id,
		};
	};
}
