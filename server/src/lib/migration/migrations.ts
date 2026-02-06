import UserFollowersMigration from "./migrations/add-following-to-users";
import AddLockedAt from "./migrations/add-lockedat";
import UGPTAddPreferredRanking from "./migrations/add-preferredRanking-to-ugpt";
import UGPTRivalsMigration from "./migrations/add-rivals-to-ugpt";
import ChunithmFixPreferredDefaultEnum from "./migrations/chunithm-fix-preferred-default-enum";
import ChunithmLampSplit from "./migrations/chunithm-lamp-split";
import FixUndefinedBMSData from "./migrations/fix-undefined-bms-data";
import JoinINFCastHourCharts from "./migrations/join-inf-casthour-charts";
import JoinINFCastHourSongs from "./migrations/join-inf-casthour-songs";
import KtRatingToCuratorSkill from "./migrations/ktRating-to-curator-skill";
import MaimaiDXFixLamps from "./migrations/maimaidx-fix-lamps";
import MarkFervidexAsWithoutIntent from "./migrations/mark-fervidex-as-without-intent";
import MarkKsHookAsWithoutIntent from "./migrations/mark-kshook-as-without-intent";
import NullLR2HookFailedBPs from "./migrations/null-lr2hook-failed-bps";
import OngekiV2 from "./migrations/ongeki-v2";
import RemoveAbove100pc from "./migrations/remove-above-100pc";
import RemoveIIDXBeginners from "./migrations/remove-iidx-beginners";
import RemoveIIDX2dxtraBeginners from "./migrations/remove-iidx-extra-beginners";
import RemoveMultifolderStats from "./migrations/remove-multifolder-stats";
import RemoveRandom from "./migrations/remove-random";
import RemoveSessionViews from "./migrations/remove-session-views";
import RmHot from "./migrations/rm-hot";
// import SdvxMaxxiveGoals from "./migrations/sdvx-maxxive-goals";
// import SdvxMaxxiveLampRearrange from "./migrations/sdvx-maxxive-lamp-rearrange";
import SessionsToScoreIDs from "./migrations/sessions-to-scoreIDs";
import UpdateJubeatPreferredTables from "./migrations/update-jubeat-preferred-tables";
import V3PropsMigration from "./migrations/v3-props";
import V3ScoresMigration from "./migrations/v3-scores";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { Environment, TachiConfig } from "lib/setup/config";
import type { Migration } from "utils/types";

const logger = CreateLogCtx(__filename);

// NOTE: This is declared here, and NOT in test-utils. If any runtime file attempts to depend
// on test-utils, the server will not boot.

export const FAKE_MIGRATION: Migration = {
	id: "fake-migration",
	up: () => db.users.update({}, { $set: { __wasMigrated: true } }, { multi: true }),
	down: () => db.users.update({}, { $unset: { __wasMigrated: 1 } }, { multi: true }),
};

// Migrations are stored in an array because they have some concept of order
// That is, migrations should ideally be applied in a fixed order just to avoid
// any potential unsavoury interactions.
// If we're testing, we should pull fake migrations instead to ensure the tests
// stay consistent
const REGISTERED_MIGRATIONS: Array<Migration> =
	Environment.nodeEnv === "test"
		? [FAKE_MIGRATION]
		: [
				UGPTRivalsMigration,
				RemoveMultifolderStats,
				UGPTAddPreferredRanking,
				UserFollowersMigration,
				RemoveSessionViews,
				SessionsToScoreIDs,
				V3PropsMigration,
				V3ScoresMigration,
				AddLockedAt,
		  ];

// only apply type-specific migrations if we're not in testing
if (Environment.nodeEnv !== "test") {
	// kamaitachi specific migrations
	if (TachiConfig.TYPE !== "boku") {
		REGISTERED_MIGRATIONS.push(
			RemoveIIDXBeginners,
			UpdateJubeatPreferredTables,
			JoinINFCastHourCharts,
			JoinINFCastHourSongs,
			MarkFervidexAsWithoutIntent,
			MarkKsHookAsWithoutIntent,
			KtRatingToCuratorSkill,
			RemoveIIDX2dxtraBeginners,
			RmHot,
			ChunithmLampSplit,
			OngekiV2,
			ChunithmFixPreferredDefaultEnum,
			// SdvxMaxxiveLampRearrange,
			// SdvxMaxxiveGoals,
			MaimaiDXFixLamps
		);
	}

	// bokutachi specific migrations
	if (TachiConfig.TYPE !== "kamai") {
		REGISTERED_MIGRATIONS.push(
			NullLR2HookFailedBPs,
			FixUndefinedBMSData,
			RemoveRandom,
			RemoveAbove100pc
		);
	}
}

function CreateMigrationLookupMap(migrations: Array<Migration>) {
	const map = new Map<string, Migration>();

	for (const mig of migrations) {
		if (map.get(mig.id)) {
			logger.crit(
				`Multiple migrations are registered for ${mig.id}. Cannot safely apply migrations.`,
				() => {
					// note, we want to exit in testing here, this is fine.
					process.exit(1);
				}
			);
		}

		map.set(mig.id, mig);
	}

	return map;
}

// That said, we still make a lookup map so we can efficiently find registered
// migrations.
const MIGRATION_LOOKUP = CreateMigrationLookupMap(REGISTERED_MIGRATIONS);

/**
 * Return the migrationID of all migrations that have not been applied.
 */
export async function FindUnappliedMigrations() {
	// An unapplied migration is one that is acknowledged in the codebase
	// (see REGISTERED_MIGRATIONS), but not stored inside the mongodb instance.
	const migrations = await db.migrations.find(
		{},
		{
			projection: {
				migrationID: 1,
			},
		}
	);

	const appliedIDs = new Set(migrations.map((e) => e.migrationID));

	const notApplied = [];

	for (const migration of REGISTERED_MIGRATIONS) {
		if (!appliedIDs.has(migration.id)) {
			notApplied.push(migration.id);
		}
	}

	return notApplied;
}

export async function ApplyUnappliedMigrations() {
	const unapplied = await FindUnappliedMigrations();

	if (unapplied.length === 0) {
		logger.verbose(`Found no migrations to apply. Not bothering.`);
		return;
	}

	logger.info(
		`Found ${
			unapplied.length
		} migration(s) that have not been applied yet. These are '${unapplied.join("', '")}'.`,
		{ unapplied }
	);

	for (const migrationID of unapplied) {
		// These things need to apply in lockstep.
		// Note that if any migration fails, this will exit at CRIT level
		// and not continue.
		// eslint-disable-next-line no-await-in-loop
		await ApplyMigrationByID(migrationID);
	}
}

export function ApplyMigrationByID(migrationID: string) {
	const migration = MIGRATION_LOOKUP.get(migrationID);

	if (!migration) {
		logger.error(
			`Attempted to apply migration ${migrationID}, but that migration doesn't exist?`
		);
		throw new Error(
			`Attempted to apply migration ${migrationID}, but that migration doesn't exist?`
		);
	}

	return ApplyMigration(migration);
}

/**
 * Applies a migration. Will **EXIT TACHI** if a migration fails to apply, as this implies
 * database level inconsistencies which could cause severe problems.
 */
export async function ApplyMigration(migration: Migration) {
	const migrationID = migration.id;

	logger.info(`Received request to apply migration '${migrationID}'.`);

	// Lock the migration here:
	// If the migration is already applied (i.e. migrationID is set and pending/applied)
	// don't bother applying again
	// If the migration isn't, set it as pending and continue. This is race-condition
	// safe.
	const wasApplied = await db.migrations.findOneAndUpdate(
		{ migrationID },
		{
			$setOnInsert: {
				migrationID,
				status: "pending",
			},
		},
		{
			returnOriginal: true,
			upsert: true,
		}
	);

	if (wasApplied) {
		logger.error(`Tried to apply migration ${migrationID}, but it was already applied.`);
		throw new Error(`Tried to apply migration ${migrationID}, but it was already applied.`);
	}

	try {
		await migration.up();

		logger.info(`Successfully applied migration '${migrationID}'.`);

		await db.migrations.update(
			{
				migrationID,
			},
			{
				$set: {
					status: "applied",
					appliedOn: Date.now(),
				},
			}
		);

		logger.info(`Successfully set migration state for '${migrationID}' to applied.`);
	} catch (err) {
		logger.severe(
			`Failed to apply migration '${migrationID}'. Attempting to revert migration. Tachi will exit after attempting to revert this migration.`,
			{ err }
		);

		try {
			await migration.down();

			logger.info(
				`Successfully reverted migration. Database state is okay, but Tachi will not boot.`
			);

			logger.crit(
				`Failed to apply migration '${migrationID}'. Although successfully reverted, Tachi will not boot if a migration fails.`
			);
		} catch (err) {
			logger.crit(
				`FAILED TO REVERT PARTIAL MIGRATION '${migrationID}'. THE DATABASE IS ALMOST CERTAINLY TAINTED. MANUAL INTERVENTION/BACKUP RESTORE NECESSARY.`,
				{
					err,
				}
			);
		}

		// remove the stale migration so it can be re-ran in the future.
		await db.migrations.findOneAndDelete({ migrationID });

		if (Environment.nodeEnv === "test") {
			throw new Error("Was going to exit with statusCode 1, but we're in testing.");
		}

		logger.crit(`Exiting.`, () => {
			process.exit(1);
		});
	}
}
