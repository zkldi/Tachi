import type { ClassProvider } from "#lib/score-import/framework/calculated-data/types";

import nodeFetch from "#utils/fetch";
import { IsRecord } from "#utils/misc";
import { SDVX_DANS } from "tachi-common";
import { SDVXDans } from "tachi-common/config/game-support/sdvx";

import type { KaiAPIReauthFunction } from "../traverse-api";

import { KaiTypeToBaseURL } from "../utils";

export async function CreateKaiSDVXClassProvider(
	kaiType: "EAG" | "FLO" | "MIN",
	token: string,
	reauthFn: KaiAPIReauthFunction,
	fetch = nodeFetch,
): Promise<ClassProvider<"sdvx">> {
	let json: unknown;
	let err: unknown;
	const baseUrl = KaiTypeToBaseURL(kaiType);

	try {
		let res = await fetch(`${baseUrl}/api/sdvx/v1/player_profile`, {
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

		json = (await res.json()) as unknown;
	} catch (e: unknown) {
		err = e;
	}

	return (_game, _userID, _ratings, log) => {
		log.info(
			{
				json,
			},
			`Got return from ${baseUrl}/api/sdvx/v1/player_profile.`,
		);

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

		if (
			json.skill_level === null ||
			json.skill_level === undefined ||
			typeof json.skill_level !== "number"
		) {
			log.info(
				{
					skillLevel: json.skill_level,
				},
				`User has no/invalid skill_level. Not updating anything.`,
			);
			return {};
		}

		const sdvxDan: number | null = json.skill_level - 1;

		if (!Number.isInteger(sdvxDan)) {
			log.warn(`${baseUrl} returned a dan of ${sdvxDan}, which was not an integer.`);
			return {};
		}

		if (sdvxDan > SDVX_DANS.INF) {
			log.warn(
				`${baseUrl} returned a dan of ${sdvxDan}, which was greater than INF (${SDVX_DANS.INF}.)`,
			);
			return {};
		}

		// Kai APIs return -1 to indicate no dan. They also sometimes return undefined.
		// I'm not too sure why.
		if (sdvxDan === -1) {
			return {};
		}

		if (sdvxDan < SDVX_DANS.DAN_1) {
			log.warn(
				`${baseUrl} returned a dan of ${sdvxDan}, which was less than DAN_1 (${SDVX_DANS.DAN_1}.)`,
			);
			return {};
		}

		const value = SDVXDans[sdvxDan];

		if (!value) {
			log.warn(`${baseUrl} returned a dan of ${sdvxDan}, which has no corresponding value.`);
			return {};
		}

		return {
			dan: value.id,
		};
	};
}
