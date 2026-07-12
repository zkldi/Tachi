import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	configTachi.node,
	{
		ignores: ["js/**", "node_modules/**"],
	},
];
