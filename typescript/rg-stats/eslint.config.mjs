import configTachi from "eslint-config-tachi";

export default [
	...configTachi.base,
	configTachi.node,
	{
		ignores: ["build/**", "node_modules/**", "tap-snapshots/**"],
	},
	{
		files: ["src/**/*.ts"],
		name: "rg-stats/vendored-style",
		rules: {
			"@typescript-eslint/consistent-type-imports": "off",
			"perfectionist/sort-exports": "off",
			// Upstream rg-stats keeps intentional ordering (e.g. score tiers, lamp unions).
			"perfectionist/sort-imports": "off",
			"perfectionist/sort-maps": "off",
			"perfectionist/sort-object-types": "off",
			"perfectionist/sort-union-types": "off",
		},
	},
];
