import type { APIPermissions } from "../types";

// Some parts of tachi-server and some parts of the schemas refer to this
// in order to assert that permissions are correctly assigned.
export const ALL_PERMISSIONS: Record<APIPermissions, true> = {
	customise_profile: true,
	customise_score: true,
	customise_session: true,
	delete_score: true,
	manage_rivals: true,
	manage_targets: true,
	submit_score: true,
	manage_challenges: true,
};
