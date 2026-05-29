import { IsNullish } from "#util/misc";
import { FormatTime, FormatTimeOfDay, FormatTimeSmall, MillisToSince } from "#util/time";
import React from "react";
import { type integer, type V3Game } from "tachi-common";

/** Same truncation pattern as TitleCell metadata lines. */
const truncLineCls = "d-block w-100 text-truncate";

export default function TimestampCell({
	service,
	tableFixedLayoutCompat,
	time,
	alwaysShort,
	game,
}: {
	alwaysShort?: boolean;
	game?: V3Game;
	service?: string | null;
	tableFixedLayoutCompat?: boolean;
	time: integer | null;
}) {
	if (game === "ongeki" && IsNullish(service)) {
		alwaysShort = true;
	}

	const widthStyle = tableFixedLayoutCompat
		? undefined
		: {
				maxWidth: "200px",
				minWidth: alwaysShort ? "50px" : "140px",
				overflow: "hidden" as const,
			};

	return (
		<td
			className={tableFixedLayoutCompat ? "folder-timeline-timestamp" : undefined}
			style={widthStyle}
		>
			{time ? (
				<>
					{MillisToSince(time, alwaysShort)}

					<br />
					<small className="text-body-secondary">
						{alwaysShort ? FormatTimeSmall(time) : FormatTime(time)}
					</small>
					{alwaysShort && (
						<>
							<br />
							<small className="text-body-secondary">{FormatTimeOfDay(time)}</small>
						</>
					)}
				</>
			) : (
				<span
					className={
						tableFixedLayoutCompat ? "text-body-secondary fst-italic" : undefined
					}
				>
					No Data.
				</span>
			)}
			{service && (
				<>
					<br />
					<small
						className={`${truncLineCls} text-body-secondary`}
						style={{ fontSize: "0.75rem", minWidth: 0, whiteSpace: "normal" }}
						title={`Played On: ${service}`}
					>
						{!alwaysShort && "Played On: "}
						{service}
					</small>
				</>
			)}
		</td>
	);
}
