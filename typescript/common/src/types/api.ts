/**
 * All the permissions a token may have.
 */
export type APIPermissions =
	| "customise_profile"
	| "customise_score"
	| "customise_session"
	| "delete_score"
	| "manage_challenges"
	| "manage_rivals"
	| "manage_targets"
	| "submit_score";

/**
 * This is the generic response from the Kamaitachi API in event of a failure.
 */
export interface UnsuccessfulAPIResponse {
	success: false;
	description: string;
}

/**
 * In the event of a successful API request, body is attached onto the request, which contains
 * endpoint-defined information about the response, such as database data.
 */
export interface SuccessfulAPIResponse<T = unknown> {
	success: true;
	description: string;

	// This isn't ideal, but we need to restrict
	// this to only objects - Record<string, unknown>
	// mandates indexability of the type, which makes
	// it unusable for known objects.
	body: T;
}
