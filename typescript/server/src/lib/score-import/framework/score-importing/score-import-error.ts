/**
 * Throw this if the ScoreImport needs to exit and return
 * something to the user. This is used for expected errors,
 * such as the user passing unparsable data. Unlike Failures,
 * throwing this at any time will exit the *entire* score import
 * process.
 */
export default class ScoreImportFatalError extends Error {
	statusCode: number;

	constructor(statusCode: number, description: string) {
		super(description);

		this.statusCode = statusCode;

		Object.setPrototypeOf(this, ScoreImportFatalError.prototype);
	}
}
