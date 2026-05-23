import React from "react";
import { type integer } from "tachi-common";
import { FmtStars, StarEnum, StarEnumToInt } from "tachi-common/config/game-support/ongeki";

export function StarField({ stars, compact }: { compact: boolean; stars: integer | StarEnum }) {
	if (typeof stars !== "number") {
		stars = StarEnumToInt(stars);
	}
	if (stars < 6) {
		return <>{FmtStars(stars, compact)}</>;
	}
	return (
		<span
			style={{
				background:
					"linear-gradient(30deg, #f0788a 5%, #f48fb1, #9174c2, #79bcf2, #70a173, #f7ff99, #faca7d, #ff9d80, #f0788a 85%)",
				color: "transparent",
				backgroundClip: "text",
			}}
		>
			★★★★★
		</span>
	);
}

export default function OngekiPlatinumCell({
	platinumScore: platinumScore,
	maxPlatScore: maxPlatScore,
	stars: stars,
}: {
	maxPlatScore: integer;
	platinumScore: integer;
	stars: StarEnum;
}) {
	const percentage = (platinumScore / maxPlatScore) * 100;
	return (
		<td>
			<div className="d-flex flex-column">
				<strong>
					{percentage.toLocaleString("en-US", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
						roundingMode: "trunc",
					} as Intl.NumberFormatOptions)}
					%
				</strong>
				<StarField compact={false} stars={stars} />
				<small className="text-body-secondary">
					[{platinumScore}/{maxPlatScore}]
				</small>
			</div>
		</td>
	);
}
