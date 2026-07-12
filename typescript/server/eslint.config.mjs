import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	configTachi.node,
	{
		ignores: [
			"js/**",
			"node_modules/**",
			"src/proto/generated/**",
			"src/lib/search/fzf/**/*.ts",
			"src/test-utils/hack-setup.js",
		],
	},
];
