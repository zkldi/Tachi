import { EfficientInPlaceDeepmerge, MutateCollection } from "./util.js";

function DoesMatchCriteria(element, mutation) {
	for (const [key, value] of Object.entries(mutation.match)) {
		if (element[key] !== value) {
			return false;
		}
	}

	return true;
}

export function ApplyMutations(name, mutations) {
	MutateCollection(name, (collection) => {
		for (const element of collection) {
			for (const mutation of mutations) {
				if (DoesMatchCriteria(element, mutation)) {
					EfficientInPlaceDeepmerge(element, mutation.data);
				}
			}
		}

		return collection;
	});
}
