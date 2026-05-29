import humaniseDuration from "humanize-duration";
import { DateTime } from "luxon";

export function MillisToSince(ms: number, short?: boolean) {
	return DateTime.fromMillis(ms).toRelative({ style: short ? "narrow" : "long" });
}

export function FormatTime(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATETIME_MED);
}

export function FormatDate(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.DATE_HUGE);
}

/** Local time of day only; use with {@link FormatDate} when the calendar date is shown separately. */
export function FormatTimeOfDay(ms: number) {
	return DateTime.fromMillis(ms).toLocaleString(DateTime.TIME_SIMPLE);
}

export function FormatDuration(ms: number) {
	return humaniseDuration(ms, {
		units: ["d", "h", "m"],
		maxDecimalPoints: 0,
	});
}

export function FormatDurationHours(ms: number) {
	return humaniseDuration(ms, {
		units: ["h"],
		maxDecimalPoints: 0,
	});
}

export function FormatTimeSmall(ms: number) {
	return DateTime.fromMillis(ms).toISODate();
}
