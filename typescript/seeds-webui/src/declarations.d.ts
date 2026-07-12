/// <reference types="vite/client" />

declare module "*.scss" {
	const css: string;
	export default css;
}

declare module "*.css" {
	const css: string;
	export default css;
}

interface ImportMetaEnv {
	readonly VITE_SEEDS_EDIT_MODE?: boolean | string;
	readonly VITE_SEEDS_REPO?: string;
	readonly VITE_SEEDS_BRANCH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
