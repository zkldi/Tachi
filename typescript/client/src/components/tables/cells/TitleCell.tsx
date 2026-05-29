import GentleLink from "#components/util/GentleLink";
import Muted from "#components/util/Muted";
import { ToCDNURL } from "#util/api";
import { CreateChartLink } from "#util/data";
import React from "react";
import { type ChartDocument, type SongDocument, type V3Game } from "tachi-common";

/** Fixed title column width; content truncates per line under `table-layout` fixed/auto. */
const TITLE_CELL_WIDTH_PX = 275;

const truncLineCls = "d-block text-truncate";

export default function TitleCell({
	game,
	song,
	chart,
	noArtist,
	comment,
	showSearchTerms,
	showAltTitles,
}: {
	// chart is optional as we overload this titlecell to render pretty song tables
	// in some places
	chart?: ChartDocument;
	comment?: string | null;
	game: V3Game;
	noArtist?: boolean;
	showAltTitles?: boolean;
	showSearchTerms?: boolean;
	song: SongDocument;
}) {
	let backgroundImage = undefined;
	let center = false;

	const tooltipParts = [
		song.title,
		!noArtist ? song.artist : undefined,
		"subtitle" in song.data && song.data.subtitle ? song.data.subtitle : undefined,
		showAltTitles && song.altTitles.length !== 0
			? `AKA ${song.altTitles.join(", ")}`
			: undefined,
		showSearchTerms && song.searchTerms.length !== 0
			? `Search Terms: ${song.searchTerms.join(", ")}`
			: undefined,
		chart && !chart.isPrimary ? `(${chart.versions.join("/")})` : undefined,
		comment ? `"${comment}"` : undefined,
	];

	const tooltipTitle = tooltipParts.some(Boolean)
		? tooltipParts.filter(Boolean).join(" — ")
		: undefined;

	const maxWidth = game === "ongeki" ? TITLE_CELL_WIDTH_PX * 0.6 : TITLE_CELL_WIDTH_PX;

	if (game === "popn" && chart) {
		backgroundImage = `url(${ToCDNURL(
			`/misc/popn/banners/${(chart as any).data.inGameID}.png`,
		)})`;
	} else if (game === "itg-stamina" && chart) {
		const itgChart = chart as ChartDocument<"itg-stamina">;
		const banner = itgChart.data.bannerLocationOverride ?? itgChart.data.originalPack;

		if (banner) {
			backgroundImage = `url(${ToCDNURL(
				`/misc/itg/banners/${encodeURIComponent(banner)}.png`,
			)})`;
			center = true;
		}
	}

	return (
		<td
			className="fading-image-td-left title-cell-wrapper"
			style={{
				boxSizing: "border-box",
				maxWidth: `${maxWidth}px`,
				minWidth: 0,
				overflow: "hidden",
				textAlign: "left",
				width: `${maxWidth}px`,
				["--image-url" as string]: backgroundImage,
				backgroundPosition: center ? "center" : undefined,
			}}
			title={tooltipTitle}
		>
			{game === "popn" && (
				<>
					<span className={`${truncLineCls} pb-1`}>
						{(song as SongDocument<"popn">).data.genre === song.title ||
						(song as SongDocument<"popn">).data.genre === null ? (
							<Muted>Unknown Genre</Muted>
						) : (
							(song as SongDocument<"popn">).data.genre
						)}
					</span>
				</>
			)}
			<GentleLink
				className="title-cell-link d-block w-100"
				style={{ minWidth: 0 }}
				to={chart ? CreateChartLink(chart) : ""}
			>
				<span className={truncLineCls} style={{ fontSize: "0.9725rem" }}>
					{song.title}
				</span>

				{!noArtist && <small className={`${truncLineCls} text-body`}>{song.artist}</small>}
				{"subtitle" in song.data && song.data.subtitle && (
					<small className={`${truncLineCls} text-body-secondary`}>
						{song.data.subtitle}
					</small>
				)}

				{showAltTitles && song.altTitles.length !== 0 && (
					<small className={`${truncLineCls} text-body-secondary`}>
						AKA {song.altTitles.join(", ")}
					</small>
				)}
				{showSearchTerms && song.searchTerms.length !== 0 && (
					<small className={`${truncLineCls} text-body-secondary`}>
						Search Terms: {song.searchTerms.join(", ")}
					</small>
				)}
				{chart && !chart.isPrimary && (
					<small className={`${truncLineCls} text-body-secondary`}>
						({chart.versions.join("/")})
					</small>
				)}
			</GentleLink>
			{comment && <small className={truncLineCls}>&quot;{comment}&quot;</small>}
		</td>
	);
}
