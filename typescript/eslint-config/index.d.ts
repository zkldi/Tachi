import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";

declare module "eslint-config-tachi" {
	export const base: FlatConfig.ConfigArray;
	export const node: FlatConfig.Config;
	export const react: FlatConfig.Config;
	export const reactRemix: FlatConfig.Config;
}
