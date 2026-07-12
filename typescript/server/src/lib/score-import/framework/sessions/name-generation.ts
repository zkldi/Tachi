import { GetRandomAdjective, GetRandomNoun } from "#datasets/words";

export function GenerateRandomSessionName() {
	const adj1 = GetRandomAdjective();
	const adj2 = GetRandomAdjective();
	const noun = GetRandomNoun();

	return `${adj1} ${adj2} ${noun}`;
}
