import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	configTachi.node,
	{
		ignores: [
			"../../db/seeds/**",
			"node_modules/**",
			"js/**",
			"**/*.js",
			// Excluded from tsconfig.json; type-aware eslint would error on every file here.
			"rerunners/**",
		],
	},
];
