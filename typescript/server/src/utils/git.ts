import path from "path";

import { asyncExec } from "./misc";

/**
 * We parse git commits into this format, it's convenient to work with and compatible
 * with GitHubs return.
 */
export interface GitCommit {
	sha: string;
	commit: {
		author: {
			date: string;
			email: string;
			name: string;
		};
		committer: {
			date: string;
			email: string;
			name: string;
		};
		message: string;
	};
	parents: Array<{
		sha: string;
	}>;
}

const format = [
	"h", // shorthash
	"B", // subject + body raw.
	"aN", // author name
	"aE", // author email
	"aI", // time authed (iso 8601)
	"cN", // committer name
	"cE", // committer email
	"cI", // committer time (iso 8601)
	"p", // parent shorthashes
	// also, git expects its prefixes to start with %.
].map((e) => `%${e}`);

// Furthermore, we need some sort of way of separating the fields, so we can
// parse them out later.
// This is kind of a problem, as we have no power to actually uh, escape things.
// I've picked ASCII's GROUP-SEPARATOR (1D).
const ASCII_GROUP_SEPARATOR = "\x1D";

// If that appears in a commit body or message it will break
// things. I hope it won't.
export const GIT_LOG_PRETTY_FORMAT = format.join(ASCII_GROUP_SEPARATOR);

/**
 * List git commits that affect the given path. Parses the output into a JS object
 * that can be easily manipulated, rather than the raw strings that git log normally
 * returns.
 *
 * **DO NOT PASS UNTRUSTED USER INPUT INTO THIS FUNCTION, AS IT IS POSSIBLE TO EXECUTE
 * ARBITRARY SHELL COMMANDS AS A RESULT.**
 *
 * @param filepath - The path to list commits for. Defaults to showing all commits.
 */
export async function ListGitCommitsInPath(
	branch: string,
	filepath = ".",
): Promise<Array<GitCommit>> {
	// make sure our path goes from the root of the repository
	const realPath = path.join(__dirname, "../../../", filepath);

	// This command certainly needs some explaining.

	// We use PAGER=cat to force git to actually output to stdout.
	// the -z flag replaces \n separators with NUL bytes, which aren't legal in commit
	// messages as far as I'm aware.
	// everything else should be obvious.
	const COMMAND = `PAGER=cat git log -b '${branch}' -z --pretty="${GIT_LOG_PRETTY_FORMAT}" -- '${realPath}'`;

	const { stdout, stderr } = await asyncExec(COMMAND);

	if (stderr) {
		throw new Error(`Failed to parse git commits: ${stderr}`);
	}

	const rows = stdout.split("\0");

	// last row always has 0 elements because the output ends with a NUL.
	rows.pop();

	const commits: Array<GitCommit> = rows.map(ParseCommit);

	return commits;
}

/**
 * Given a string formatted with GIT_LOG_PRETTY_FORMAT, parse it into a data structure.
 */
function ParseCommit(commitStr: string): GitCommit {
	const split = commitStr.split(ASCII_GROUP_SEPARATOR);

	if (split.length !== format.length) {
		throw new Error(`Expected ${format.length} elements. got ${split.length}.`);
	}

	const [
		sha,
		message,
		authName,
		authEmail,
		timeAuthed,
		cmtName,
		cmtEmail,
		timeCommitted,
		parentShortHashes,
	] = split as [string, string, string, string, string, string, string, string, string];

	return {
		sha,
		commit: {
			author: {
				date: timeAuthed,
				email: authEmail,
				name: authName,
			},
			committer: {
				date: timeCommitted,
				email: cmtEmail,
				name: cmtName,
			},

			// trim off the trailing \n from every message.
			// all messages end with an extraneous newline, and we don't want it.
			message: message.trim(),
		},

		// parentShortHashes are given in the form
		// 6c785b54 f03d8ab1.
		// we split these on spaces to convert them into an array. Simple!
		parents: parentShortHashes.split(" ").map((sha) => ({
			sha,
		})),
	};
}

export async function GetCommit(sha: string) {
	const COMMAND = `PAGER=cat git show -q --pretty="${GIT_LOG_PRETTY_FORMAT}" '${sha}'`;

	const { stdout, stderr } = await asyncExec(COMMAND);

	if (stderr) {
		throw new Error(`Failed to parse git commits: ${stderr}`);
	}

	return ParseCommit(stdout);
}
