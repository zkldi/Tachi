import { BacksyncBMSPMSSongsAndCharts } from "../backsync-bms-pms-data";
import { UpdateAILevels } from "../bms-ai-table-sync";
import { SyncBMSTables } from "../bms-table-sync";
import { DeorphanScoresMain } from "../deorphan-scores";
import { UGSSnapshot } from "../ugs-snapshot";
import { UpdatePoyashiData } from "../update-bpi-data";
import { UpdateDPTiers } from "../update-dp-tiers";
import { Queue, Worker } from "bullmq";
import CreateLogCtx from "lib/logger/logger";
import { TachiConfig } from "lib/setup/config";
import { DedupeArr } from "utils/misc";

interface Job {
	name: string;
	cronFormat: string;
	run: () => Promise<void>;
}

const jobs: Array<Job> = [
	{
		name: "Snapshot User Game Stats",
		cronFormat: "0 0 * * *",
		run: UGSSnapshot,
	},
	{
		name: "De-Orphan Scores",

		// We run an hour after snapshotting UGS
		// just to spread load out a bit.
		cronFormat: "1 0 * * *",
		run: DeorphanScoresMain,
	},
];

// if kamaitachi or omnitachi
if (TachiConfig.TYPE !== "boku") {
	jobs.push({
		name: "Update BPI",
		cronFormat: "2 0 * * *",
		run: UpdatePoyashiData,
	});

	jobs.push({
		name: "Update DP Tiers",
		cronFormat: "3 0 * * *",
		run: UpdateDPTiers,
	});
}

// if bokutachi or omnitachi
if (TachiConfig.TYPE !== "kamai") {
	jobs.push({
		name: "Update AI Table",
		cronFormat: "2 0 * * *",
		run: UpdateAILevels,
	});

	jobs.push({
		name: "Update Tables",
		cronFormat: "3 0 * * *",
		run: SyncBMSTables,
	});

	jobs.push({
		name: "Backsync BMS + PMS",
		cronFormat: "4 0 * * *",
		run: BacksyncBMSPMSSongsAndCharts,
	});
}

const logger = CreateLogCtx("JOB_RUNNER");

/**
 * Initalises a tachi-server job runner.
 * This runs the list of jobs defined in jobConfig.jobs.
 */
export function InitialiseJobRunner() {
	logger.info(`Booting up Job Runner.`);

	const names = jobs.map((e) => e.name);

	if (DedupeArr(names).length !== names.length) {
		logger.crit(`Jobs has duplicate name fields, refusing to run.`, () => {
			process.exit(1);
		});
	}

	const JobQueue = new Queue("Job Runner");

	const jobNameMap = new Map<string, Job>();

	for (const job of jobs) {
		void JobQueue.add(job.name, { jobName: job.name }, { repeat: { cron: job.cronFormat } });
		jobNameMap.set(job.name, job);
	}

	const worker = new Worker("Job Runner", async (j) => {
		const { jobName } = j.data as { jobName: string };

		logger.info(`Running job ${jobName}.`);

		const jobInfo = jobNameMap.get(jobName);

		if (!jobInfo) {
			logger.severe(`Unknown job name ${jobName}, couldn't find a run function?`);
			return false;
		}

		await jobInfo.run();

		return true;
	});

	logger.info(`Initialised ${jobs.length} jobs (${jobs.map((e) => e.name).join(", ")}).`);

	return worker;
}

if (require.main === module) {
	InitialiseJobRunner();
}
