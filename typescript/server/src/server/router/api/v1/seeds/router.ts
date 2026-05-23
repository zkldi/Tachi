import { log } from "#lib/log/log";
import { withLocalDev } from "#lib/router/middleware";
import { success } from "#lib/router/typed-router";
import { PullDatabaseSeeds, SEEDS_COLLECTIONS_DIR } from "#lib/seeds/repo";
import { Env } from "#lib/setup/config";
import { GetCommit, ListGitCommitsInPath } from "#utils/git";
import { asyncExec, IsString } from "#utils/misc";
import { ExpectedErr } from "bliss";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { API_V1_ROUTER } from "../_singleton";

// Routes for interacting with the `seeds` folder in this instance of Tachi.

// Why do we have this, and why is it limited to only local development?
// The answer is that we have a "Seeds UI" that runs in the client. For local development
// it's useful to be able to see the current state of the seeds on-disk, and diff that
// against various local commits. As such, we need an api such that the client can
// interface with our local seeds.

// In production/staging, we use GitHub as a source of truth for our git repository.
// In local dev, we have this option available too, but we also enable this API.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// there's a lady who's sure
// all that glitters is gold
const LOCAL_DEV_SEEDS_PATH = path.join(__dirname, "../../../../../../../../db/seeds");
const TEST_SEEDS_PATH = path.join(__dirname, "../../../../../test-utils/mock-db");

const LOCAL_SEEDS_PATH = Env.NODE_ENV === "test" ? TEST_SEEDS_PATH : LOCAL_DEV_SEEDS_PATH;

/**
 * No-Op route for checking whether this feature is supported by this instance of Tachi.
 *
 * @name GET /api/v1/seeds
 */
API_V1_ROUTER.add("GET /seeds", withLocalDev, () =>
	success("Local seeds are available on this instance of Tachi.", {}),
);

/**
 * Check whether there are changes to the seeds in this local development
 * instance that have not been committed yet.
 */
API_V1_ROUTER.add("GET /seeds/has-uncommitted-changes", withLocalDev, async () => {
	const { stdout, stderr } = await asyncExec("git status --porcelain");

	if (stderr) {
		log.error({ stderr }, "Failed to read git status --porcelain.");
		throw new ExpectedErr(500, "Failed to check current git status.");
	}

	// if any change contains seeds/collections, it's probably uncommitted
	// local changes.
	//
	// note that doing this properly is frustrating. This has false positives for
	// routes that partially contain this route. I've ameliorated this slightly with
	// a leading space, but that is not a proper solution.
	const hasUncommittedChanges = stdout
		.split("\n")
		.some((row) => row.includes(` ${SEEDS_COLLECTIONS_DIR}`));

	return success(
		hasUncommittedChanges
			? "This local instance has uncommitted changes."
			: "This local instance does not have uncommitted changes.",
		hasUncommittedChanges,
	);
});

/**
 * List commits that have affected seeds.
 *
 * This format is a partial implementation of what GitHub's REST API returns. As such,
 * an implementing client has far less work to do with respect to handling local + remote
 * servers.
 *
 * @param file - If provided, only returns commits that have touched this specific file.
 */
API_V1_ROUTER.add("GET /seeds/commits", withLocalDev, async ({ input }) => {
	const { branch, file } = input;

	const seeds = await PullDatabaseSeeds();
	const collections = (await seeds.ListCollections()).map((e) => `${e}.json`);

	if (IsString(file) && !collections.includes(file)) {
		throw new ExpectedErr(
			400,
			`Invalid file of '${file}' requested. Expected any of ${collections.join(", ")}`,
		);
	}

	// if we don't have a file, use the do-nothing path.
	const realFile = file ?? ".";

	// only check commits in seeds/collections
	const commits = await ListGitCommitsInPath(branch, path.join(SEEDS_COLLECTIONS_DIR, realFile));

	return success(`Found ${commits.length} commits.`, commits);
});

/**
 * List branches available on this local repository.
 *
 * This returns all branches under `branches`, and the currently selected branch
 * as `checkedout`, which might be null if the HEAD is currently detached.
 */
API_V1_ROUTER.add("GET /seeds/branches", withLocalDev, async () => {
	const { stdout: branches } = await asyncExec("PAGER=cat git branch --no-color -v");

	const allBranches: Array<{ name: string; sha: string }> = [];
	let currentBranch: { name: string; sha: string } | null = null;

	for (const branchStr of branches.split("\n")) {
		const match = /^ *(\*?) +(.*?) +([a-f0-9]*)/u.exec(branchStr) as
			| [string, string, string, string]
			| null;

		if (match === null) {
			continue;
		}

		const [, isCurrent, branchName, sha] = match;

		if (branchName.startsWith("(HEAD detatched at") || branchName === "") {
			continue;
		}

		const branch = { name: branchName, sha };

		if (isCurrent === "*") {
			currentBranch = branch;
		}

		allBranches.push(branch);
	}

	return success(`Found ${allBranches.length} branches.`, {
		branches: allBranches,
		current: currentBranch,
	});
});

/**
 * Retrieve the current state of the collection as of this revision.
 *
 * This returns a record of "songs-iidx.json" -> PARSED_SONGS_IIDX_JSON_CONTENT
 * for all collections as of that current revision. As such, you should treat all
 * returned records as if they might not be present (as they might not be).
 *
 * @param revision - The revision fetched. This is resolved using standard git rules,
 * and can therefore be a branch name, a commit name, or anything else git will resolve
 * like HEAD@{2020-01-01}.
 *
 * If no revision is provided, the current uncommitted state on disk is returned instead.
 */
API_V1_ROUTER.add("GET /seeds/collections", withLocalDev, async ({ input }) => {
	const rev = input.revision;
	const data: Record<string, unknown> = {};

	if (rev === undefined) {
		const files = await fs.readdir(LOCAL_SEEDS_PATH);

		await Promise.all(
			files.map(async (file) => {
				const content = await fs.readFile(path.join(LOCAL_SEEDS_PATH, file), "utf-8");
				data[file] = JSON.parse(content);
			}),
		);
	} else {
		if (rev.includes(":")) {
			throw new ExpectedErr(400, "Git Revisions cannot contain ':' characters.");
		}

		// @warn we don't actually bother doing any real shell
		// escaping here, since these routes are only enabled in local development.
		const { stdout: fileStdout } = await asyncExec(
			`PAGER=cat git show '${rev}:${SEEDS_COLLECTIONS_DIR}' | tail -n +3`,
		);

		// @warn this breaks for files that have newlines in their names.
		// also, this ends with a trailing newline which means we get a trailing
		// empty filename, gotta strip that out.
		const files = fileStdout.split("\n").filter((e) => e !== "");

		await Promise.all(
			files.map(async (file) => {
				// git show fails with 128 *if* this file doesn't exist at the time
				// of this commit. however, the files we're iterating over are the
				// files in the collection as of this commit, so, this should never
				// crash in that way, right?
				const { stdout: content } = await asyncExec(
					`PAGER=cat git show '${rev}:${SEEDS_COLLECTIONS_DIR}/${file}'`,
				);
				data[file] = JSON.parse(content);
			}),
		);
	}

	return success(`Retrieved data ${rev ? `as of ${rev}` : "off of the current disk"}.`, data);
});

/**
 * Retrieve information about the provided commit.
 *
 * @param sha - The commit to fetch information about. Technically, this can be the name
 * of any git object, but you probably shouldn't.
 */
API_V1_ROUTER.add("GET /seeds/commit", withLocalDev, async ({ input }) => {
	try {
		const commit = await GetCommit(input.sha);

		return success(`Found commit '${input.sha}'.`, commit);
	} catch (err) {
		log.info({ err }, "Failed to fetch commit.");
		throw new ExpectedErr(404, "Failed to fetch commit. It may not exist.");
	}
});
