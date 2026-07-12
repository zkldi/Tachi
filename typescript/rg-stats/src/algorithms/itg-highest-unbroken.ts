import { ThrowIf } from "../util/throw-if";

/**
 * Given an array of notes per measure, NPS per measure and (optionally) when the user died
 * calculate the fastest series of unbroken '16ths' at N measures.
 *
 * 32 @ 190 will return 190,
 * 96 @ 190, user died at m40 is converted to 40 @ 190 and will return 190.
 *
 * 31 @ 190 will return null,
 * 32 @ 200 / 32 @ 220 will return 220.
 * 31 @ 200 into 1 @ 50 will return 50. (assuming no break between the streams)
 *
 * @param npsPerMeasure - The notes per second per measure.
 * @param notesPerMeasure - The notes per measure.
 * @param diedAt - Optionally, when to cut this short, such as if the user died at measure
 * 39, and still might've technically did 32 measures of stream.
 * @param measures - Optionally, override how many measures need to be unbroken. This must
 * be greater than 1. This allows you to calculate Highest 256, or similar.
 *
 * @returns The BPM of the highest N unbroken measures in this chart.
 */
export function calculateFromNPSPerMeasure(
	npsPerMeasure: Array<number>,
	notesPerMeasure: Array<number>,
	diedAt: number | null = null,
	measures = 32,
): number | null {
	// Implementation note: Measures of 1 is annoying to handle, and nobody should
	// ever want to calculate that because it's stupid. Just gonna not allow it.
	ThrowIf(measures <= 1, `Measures must be greater than 1`, { measures });
	ThrowIf(
		npsPerMeasure.length !== notesPerMeasure.length,
		`Notes Per Measure and NPS Per Measure didn't have the same length.`,
		{ npsLen: npsPerMeasure.length, notesLen: notesPerMeasure.length },
	);
	ThrowIf(diedAt !== null && diedAt < 0, `DiedAt must be positive.`, {
		diedAt: diedAt ?? "Null? (Impossible)",
	});

	// Given an array of equivalent bpms per measure, return the fastest bpm
	// this user could've effectively streamed N measures of.
	let candidates: Array<Candidate> = [];

	let highestUnbroken: number | null = null;

	const measureData = npsPerMeasure.map((e, i) => [e, notesPerMeasure[i]]);

	// If the user died at an earlier measure, only iterate through those measures.
	for (let curMeasureIdx = 0; curMeasureIdx < (diedAt ?? measureData.length); curMeasureIdx++) {
		const [nps, notes] = measureData[curMeasureIdx];

		// if any measure we're in stops doing anything, this is a break.
		// lerping over this sucks and is counterintuitive, so we're not going to.
		if (notes === 0) {
			candidates = [];
		}

		const unexhaustedCandidates: Array<Candidate> = [];

		for (const candidate of candidates) {
			candidate.npsWindow.push(nps);
			candidate.notesWindow.push(notes);

			// If this window contains more than (16 * measures) notes
			// it meets the criteria for fastest unbroken of 16ths for N measures.
			if (candidate.notesWindow.reduce((a, e) => a + e, 0) >= measures * 16) {
				const lowestNPSInWindow = candidate.npsWindow.slice(0).sort((a, b) => a - b)[0];

				// if highestUnbroken is null, this is our best shot
				if (highestUnbroken === null || lowestNPSInWindow > highestUnbroken) {
					highestUnbroken = lowestNPSInWindow;
				}
			} else {
				unexhaustedCandidates.push(candidate);
			}
		}

		// Only keep candidates who's window doesn't already subsume 512 notes.
		candidates = unexhaustedCandidates;

		candidates.push({
			// for debugging
			windowStart: curMeasureIdx,
			npsWindow: [nps],
			notesWindow: [notes],
		});
	}

	if (highestUnbroken === null) {
		return null;
	}

	return npsToBPM(highestUnbroken);
}

interface Candidate {
	windowStart: number;
	npsWindow: Array<number>;
	notesWindow: Array<number>;
}

/**
 * Given an array of bpms per measure instead of nps per measure, calculate the fastest
 * N measures of unbroken streams played. This is a thin wrapper around the NPS/Measure
 * calculator, used for humanising input.
 *
 * {@see calculateFromNPSPerMeasure}
 */
export function calculateFromBPMPerMeasure(
	bpmPerMeasure: Array<number>,
	notesPerMeasure: Array<number>,
	diedAt?: null | number,
	measures?: number,
): number | null {
	return calculateFromNPSPerMeasure(
		bpmPerMeasure.map(bpmToNPS),
		notesPerMeasure,
		diedAt,
		measures,
	);
}

// Always assume 4/4 time. I know it sucks, but stepmania does the same.
function npsToBPM(nps: number) {
	return (nps * 60) / 4;
}

function bpmToNPS(bpm: number) {
	return (bpm * 4) / 60;
}
