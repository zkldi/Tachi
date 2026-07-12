import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	{
		ignores: ["build/**", "js/**", "node_modules/**"],
	},
];
