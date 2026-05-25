import type { ClassAchievementSource } from "tachi-common";

export interface ClassProcessOptions {
	allowProvidedDowngrades?: boolean;
	classAchievementSource?: ClassAchievementSource;
}

export const MANUAL_CLASS_IMPORT_OPTIONS: ClassProcessOptions = {
	allowProvidedDowngrades: true,
	classAchievementSource: "manual",
};
