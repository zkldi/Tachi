import type { ClassAchievementSource } from "tachi-common";

export interface ClassProcessOptions {
	allowProvidedDowngrades?: boolean;
	/** When true, explicit `null` in merged classes clears this class (manual import-class). */
	allowUnsettingClasses?: boolean;
	classAchievementSource?: ClassAchievementSource;
}

export const MANUAL_CLASS_IMPORT_OPTIONS: ClassProcessOptions = {
	allowProvidedDowngrades: true,
	allowUnsettingClasses: true,
	classAchievementSource: "manual",
};
