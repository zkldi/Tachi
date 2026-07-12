import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	{
		ignores: [
			"src/generated/**",
			"js/**",
			"build/**",
			"node_modules/**",
			"**/*.js",
			"**/*.d.ts",
		],
	},
];
