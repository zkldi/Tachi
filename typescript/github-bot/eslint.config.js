import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	configTachi.node,
	{
		ignores: ["build/*", "node_modules/*"],
	},
];
