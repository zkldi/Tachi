import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	{
		ignores: ["node_modules/**", "**/*.js"],
	},
];
