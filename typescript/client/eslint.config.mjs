import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	{
		...configTachi.node,
		files: ["vite.config.ts"],
		languageOptions: {
			...configTachi.node.languageOptions,
			parserOptions: {
				project: ["./tsconfig.node.json"],
			},
		},
	},
	configTachi.react,
	{
		ignores: ["build/**", "public/**", "node_modules/**"],
	},
];
