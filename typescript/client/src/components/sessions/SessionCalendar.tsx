import QuickTooltip from "#components/layout/misc/QuickTooltip";
import ApiError from "#components/util/ApiError";
import Divider from "#components/util/Divider";
import LinkButton from "#components/util/LinkButton";
import Loading from "#components/util/Loading";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import { type SessionReturns } from "#types/api-returns";
import { type GameProfileProps } from "#types/react";
import { ChangeOpacity } from "#util/color-opacity";
import { type EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import { Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { COLOUR_SET, FormatGame, type SessionDocument, type UserDocument } from "tachi-common";

import SessionRaiseBreakdown from "./SessionRaiseBreakdown";

type MinSession = Pick<
	SessionDocument,
	"desc" | "game" | "highlight" | "name" | "sessionID" | "timeEnded" | "timeStarted"
>;

export default function SessionCalendar({
	user,
	url,
	shouldDifferentiateGames,
}: {
	shouldDifferentiateGames?: boolean;
	url: string;
	user: UserDocument;
}) {
	const { data, error } = useApiQuery<Array<MinSession>>(url);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<FullCalendar
			eventBackgroundColor="transparent"
			eventBorderColor="transparent"
			eventContent={(e) => (
				<QuickTooltip
					delay={100}
					max
					tooltipContent={
						<SessionTooltip
							game={e.event.extendedProps.game}
							reqUser={user}
							sessionID={e.event.extendedProps.sessionID}
						/>
					}
				>
					<Link
						className="w-100"
						style={{
							textOverflow: "ellipsis",
							wordWrap: "break-word",
						}}
						to={`/u/${user.username}/games/${e.event.extendedProps.game}/sessions/${e.event.extendedProps.sessionID}`}
					>
						<div
							className="rounded m-1"
							style={{
								boxShadow: "var(--bs-box-shadow-sm)",
								backgroundColor: ChangeOpacity(
									e.event.extendedProps.highlight
										? COLOUR_SET.gold
										: COLOUR_SET.gray,
									0.33,
								),
							}}
						>
							<div
								className="p-2 d-lg-none overflow-hidden"
								style={{
									textOverflow: "ellipsis",
									maxWidth: "100%",
								}}
							>
								<b>{e.event.title}</b>
							</div>

							<div
								className="p-2 d-none d-lg-block"
								style={{
									whiteSpace: "pre-wrap",
								}}
							>
								<b>{e.event.title}</b>
								{e.event.extendedProps.desc && (
									<>
										<br />
										<span>{e.event.extendedProps.desc}</span>
									</>
								)}
								{shouldDifferentiateGames && (
									<>
										<br />
										<span>{FormatGame(e.event.extendedProps.game)}</span>
									</>
								)}
							</div>
						</div>
					</Link>
				</QuickTooltip>
			)}
			events={data.map(convertSession)}
			initialView="dayGridMonth"
			plugins={[dayGridPlugin]}
		/>
	);
}

function SessionTooltip({ sessionID, game, reqUser }: { sessionID: string } & GameProfileProps) {
	const { data, error } = useApiQuery<SessionReturns>(`/sessions/${sessionID}`);

	if (error) {
		return <ApiError error={error} />;
	}

	if (!data) {
		return <Loading />;
	}

	return (
		<div className="w-100 d-flex flex-column p-4 align-items-center">
			<div className="w-100">
				<h4 className="text-center">{data.session.name}</h4>
				{data.session.desc && <Muted>{data.session.desc}</Muted>}
				<Divider />
			</div>
			<Row className="w-100" style={{ maxHeight: "500px", overflowY: "auto" }}>
				<SessionRaiseBreakdown noHeader sessionData={data} />
			</Row>
			<div className="w-100 text-center">
				<Divider />
				<LinkButton to={`/u/${reqUser.username}/games/${game}/sessions/${sessionID}`}>
					View Session
				</LinkButton>
			</div>
		</div>
	);
}

function convertSession(min: MinSession): EventInput {
	return {
		start: min.timeStarted,
		end: min.timeStarted,
		// end: min.timeEnded,
		title: min.name,
		extendedProps: {
			desc: min.desc,
			highlight: min.highlight,
			sessionID: min.sessionID,
			game: min.game,
		},
	};
}

// {
//     "event": {
//         "title": "The Return.",
//         "start": "2021-12-14T15:46:09.086Z",
//         "end": "2021-12-14T17:54:02.697Z"
//     },
//     "view": {
//         "type": "dayGridMonth",
//         "dateEnv": {
//             "timeZone": "local",
//             "canComputeOffset": true,
//             "calendarSystem": {},
//             "locale": {
//                 "codeArg": "en",
//                 "codes": [
//                     "en"
//                 ],
//                 "week": {
//                     "dow": 0,
//                     "doy": 4
//                 },
//                 "simpleNumberFormat": {},
//                 "options": {
//                     "direction": "ltr",
//                     "buttonText": {
//                         "prev": "prev",
//                         "next": "next",
//                         "prevYear": "prev year",
//                         "nextYear": "next year",
//                         "year": "year",
//                         "today": "today",
//                         "month": "month",
//                         "week": "week",
//                         "day": "day",
//                         "list": "list"
//                     },
//                     "weekText": "W",
//                     "weekTextLong": "Week",
//                     "closeHint": "Close",
//                     "timeHint": "Time",
//                     "eventHint": "Event",
//                     "allDayText": "all-day",
//                     "moreLinkText": "more",
//                     "noEventsText": "No events to display",
//                     "buttonHints": {
//                         "prev": "Previous $0",
//                         "next": "Next $0"
//                     },
//                     "viewHint": "$0 view",
//                     "navLinkHint": "Go to $0"
//                 }
//             },
//             "weekDow": 0,
//             "weekDoy": 4,
//             "weekText": "W",
//             "weekTextLong": "Week",
//             "cmdFormatter": null,
//             "defaultSeparator": " - "
//         }
//     },
//     "timeText": "3:46p",
//     "textColor": "",
//     "backgroundColor": "",
//     "borderColor": "",
//     "isDraggable": false,
//     "isStartResizable": false,
//     "isEndResizable": false,
//     "isMirror": false,
//     "isStart": true,
//     "isEnd": true,
//     "isPast": true,
//     "isFuture": false,
//     "isToday": false,
//     "isSelected": false,
//     "isDragging": false,
//     "isResizing": false
// }
