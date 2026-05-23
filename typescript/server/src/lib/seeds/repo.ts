import type { GameGroup, V3Game } from "tachi-common";

import fs from "fs/promises";
/* eslint-disable no-await-in-loop */
import { log } from "#lib/log/log";
import { Env, ServerConfig } from "#lib/setup/config";
import { asyncExec } from "#utils/misc";
import os from "os";
import path from "path";

/** On-disk seed JSON basename (no extension), e.g. `songs-iidx`, `charts-bms-7k`. */
export type SeedsCollections =
	| "bms-course-lookup"
	| "folders"
	| "goals"
	| "questlines"
	| "quests"
	| "tables"
	| `charts-${V3Game}`
	| `songs-${GameGroup}`;

/** Relative to the monorepo root. */
export const SEEDS_COLLECTIONS_DIR = "db/seeds";

interface DatabaseSeedsRepoOpts {
	/** Monorepo root containing `db/seeds` and `typescript/seeds-scripts`. */
	repoRoot: string;
	shouldDestroy?: "YES_IM_SURE_PLEASE_LET_THIS_DIRECTORY_BE_RM_RFD" | false;
	/** When set, `.Destroy()` removes this path instead of `baseDir`. */
	destroyPath?: string;
}

/**
 * Class that encapsulates the behaviour of a seeds repo.
 */
export class DatabaseSeedsRepo {
	private readonly baseDir: string;
	private readonly destroyPath: string;
	private readonly repoRoot: string;
	private readonly shouldDestroy: "YES_IM_SURE_PLEASE_LET_THIS_DIRECTORY_BE_RM_RFD" | false;

	/**
	 * @param baseDir - Absolute path to `db/seeds` (the collections directory).
	 */
	constructor(baseDir: string, opts: DatabaseSeedsRepoOpts) {
		this.baseDir = baseDir;
		this.repoRoot = opts.repoRoot;
		this.shouldDestroy = opts.shouldDestroy ?? false;
		this.destroyPath = opts.destroyPath ?? baseDir;
	}

	/**
	 * Provide authentication so that CommitChangesBack can do its job.
	 */
	#AuthenticateWithGitServer() {
		if (!ServerConfig.SEEDS_CONFIG) {
			// Shouldn't be possible. Ever, since SEEDS_CONFIG must be defined in order
			// to run PullDBSeeds
			throw new Error(`Cannot commit changes back. SEEDS_CONFIG is not set.`);
		}

		if (ServerConfig.SEEDS_CONFIG.TYPE !== "GIT_REPO") {
			throw new Error(`Cannot commit changes back: this is a local filesystem.`);
		}

		if (!ServerConfig.SEEDS_CONFIG.USER_NAME || !ServerConfig.SEEDS_CONFIG.USER_EMAIL) {
			throw new Error(
				`Cannot commit changes back if SEEDS_CONFIG.USER_NAME/SEEDS_CONFIG.USER_EMAIL aren't defined.`,
			);
		}

		// TS complains that SEEDS_CONFIG.USER_EMAIL might not still be a string by the time the second
		// callback is called, so lets just define it to a local variable.
		const email = ServerConfig.SEEDS_CONFIG.USER_EMAIL;

		const url = new URL(ServerConfig.SEEDS_CONFIG.REPO_URL);

		return asyncExec(
			`git config user.name "${ServerConfig.SEEDS_CONFIG.USER_NAME}"`,
			this.repoRoot,
		)
			.then(() => asyncExec(`git config user.email "${email}"`, this.repoRoot))
			.then(() =>
				asyncExec(
					`git remote set-url origin "https://$GIT_USERNAME:$GIT_PASSWORD@${url.host}${url.pathname}"`,
					this.repoRoot,
				),
			);
	}

	private CollectionNameToPath(collectionName: SeedsCollections) {
		return path.join(this.baseDir, `${collectionName}.json`);
	}

	private async runSortSeeds(): Promise<void> {
		const sortScript = this.sortSeedsScriptPath();
		await asyncExec(`node "${sortScript}"`, this.repoRoot);
	}

	private sortSeedsScriptPath(): string {
		return path.join(this.repoRoot, "typescript/seeds-scripts/sort-seeds.js");
	}

	/**
	 * Checks for any diffs in the seeds repository we cloned. If there are any, commit them back
	 * to the repository.
	 *
	 * @param commitMsg - The commit message.
	 * @returns True when a commit has occurred, false when it hasn't. Throws on failure.
	 */
	async CommitChangesBack(commitMsg: string) {
		log.debug(`Received commit-back request.`);

		try {
			const { stdout: statusOut } = await asyncExec(
				`git status --porcelain -- ${SEEDS_COLLECTIONS_DIR}`,
				this.repoRoot,
			);

			if (statusOut === "") {
				log.info(`No changes. Not committing any changes back.`);
				return false;
			}

			log.info(`Changes detected. Authenticating with Github.`);

			await this.#AuthenticateWithGitServer();

			await asyncExec(`git add -- ${SEEDS_COLLECTIONS_DIR}`, this.repoRoot);
			const { stdout: commitOut } = await asyncExec(
				`git commit -m "automated: ${commitMsg}" -- ${SEEDS_COLLECTIONS_DIR}`,
				this.repoRoot,
			);

			await asyncExec(`git push`, this.repoRoot);

			log.info(`Commit: ${commitOut}.`);

			return true;
		} catch (err) {
			log.error({ err }, `Failed to backport commits?`);
			throw err;
		}
	}

	Destroy() {
		if (this.shouldDestroy === "YES_IM_SURE_PLEASE_LET_THIS_DIRECTORY_BE_RM_RFD") {
			// scary
			return fs.rm(this.destroyPath, { recursive: true, force: true });
		}

		log.info(`Refusing to delete seeds as they were instantiated locally.`);
	}

	async *IterateCollections() {
		const collectionNames = await this.ListCollections();

		for (const collectionName of collectionNames) {
			yield { collectionName, data: await this.ReadCollection(collectionName) };
		}
	}

	/**
	 * Get all available collections as bare filenames, without any extension.
	 *
	 * As an example, `db/seeds/songs-iidx.json` would be "songs-iidx".
	 */
	async ListCollections() {
		const colls = await fs.readdir(this.baseDir);

		return colls
			.filter((name) => name.endsWith(".json"))
			.map((e) => path.parse(e).name) as Array<SeedsCollections>;
	}

	/**
	 * Mutate a collection with a given name.
	 *
	 * @param collectionName - The collection to mutate.
	 * @param mutator - A function that takes the entire collection as an array, then returns a new array.
	 */
	async MutateCollection<D>(
		collectionName: SeedsCollections,
		mutator: (dataset: Array<D>) => Array<D>,
	) {
		const dataset = await this.ReadCollection<D>(collectionName);

		const newData = mutator(dataset);

		return this.WriteCollection(collectionName, newData);
	}

	/**
	 * Pull any seeds changes in this repository.
	 */
	pull() {
		if (Env.NODE_ENV === "dev") {
			// prevent an awful interaction where a user edits stuff on their disk
			// and tries to run pnpm load-seeds
			// but it fails because pull can't rebase with changes.
			log.warn(`Not pulling any updates to seeds as we're in local dev.`);
			return;
		}

		log.info(`Pulling updates.`);
		return asyncExec(`git pull`, this.repoRoot);
	}

	/**
	 * Reads the data from a collection and returns the parsed JSON.
	 *
	 * @returns The data in the requested collection.
	 */
	async ReadCollection<D>(collectionName: SeedsCollections): Promise<Array<D>> {
		const data = await fs.readFile(this.CollectionNameToPath(collectionName), {
			encoding: "utf-8",
		});

		const parsedData = JSON.parse(data) as Array<D>;

		return parsedData;
	}

	/**
	 * Switch this repository to a new branch. This operation may
	 * fail if there are uncommitted changes.
	 */
	switchBranch(newBranch: string) {
		log.info(`Switching to '${newBranch}'...`);
		return asyncExec(`git switch '${newBranch}'`, this.repoRoot);
	}

	/**
	 * Writes a new array to the provided collectionName.
	 *
	 * @param collectionName - The collection to write to.
	 * @param content - A new array of objects to write.
	 */
	async WriteCollection(collectionName: SeedsCollections, content: Array<unknown>) {
		await fs.writeFile(
			this.CollectionNameToPath(collectionName),
			JSON.stringify(content, null, "\t"),
		);

		await this.runSortSeeds();
	}
}

function seedsRepoFromBaseDir(
	baseDir: string,
	opts: { repoRoot?: string } & Omit<DatabaseSeedsRepoOpts, "repoRoot">,
): DatabaseSeedsRepo {
	const repoRoot = opts.repoRoot ?? path.resolve(baseDir, "../..");
	return new DatabaseSeedsRepo(baseDir, { ...opts, repoRoot });
}

/**
 * Pulls the database seeds from github, returns an object that can be used to manipulate them.
 */
export async function PullDatabaseSeeds() {
	if (ServerConfig.SEEDS_CONFIG?.TYPE === "GIT_REPO") {
		const seedsDir = await fs.mkdtemp(path.join(os.tmpdir(), "tachi-seeds-"));

		log.info(`Cloning data to ${seedsDir}.`);

		await fs.rm(seedsDir, { recursive: true, force: true });

		try {
			const branch = ServerConfig.SEEDS_CONFIG.BRANCH ?? "main";

			// stderr in git clone is normal output.
			// stdout is for errors.
			const { stdout: cloneStdout } = await asyncExec(
				`git clone --sparse --depth=1 "${ServerConfig.SEEDS_CONFIG.REPO_URL}" -b "${branch}" "${seedsDir}"`,
			);

			if (cloneStdout) {
				throw new Error(cloneStdout);
			}

			const { stdout: checkoutStdout } = await asyncExec(
				`git sparse-checkout set ${SEEDS_COLLECTIONS_DIR} typescript/seeds-scripts`,
				seedsDir,
			);

			if (checkoutStdout) {
				throw new Error(checkoutStdout);
			}

			return seedsRepoFromBaseDir(path.join(seedsDir, SEEDS_COLLECTIONS_DIR), {
				repoRoot: seedsDir,
				destroyPath: seedsDir,
				shouldDestroy: "YES_IM_SURE_PLEASE_LET_THIS_DIRECTORY_BE_RM_RFD",
			});
		} catch (e) {
			const { err, stderr } = e as { err: Error; stderr: string };
			log.error(`Error cloning seeds. ${stderr}.`);
			throw err;
		}
	} else if (ServerConfig.SEEDS_CONFIG?.TYPE === "LOCAL_FILES") {
		const local = seedsRepoFromBaseDir(ServerConfig.SEEDS_CONFIG.PATH, {
			shouldDestroy: false,
		});

		await local.pull();

		return local;
	} else {
		throw new Error(`SEEDS_CONFIG was not defined. You cannot pull a seeds repo.`);
	}
}
