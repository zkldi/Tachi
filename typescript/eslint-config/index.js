import eslint from "@eslint/js";
import configPrettier from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import pluginTachiImports from "./rules/tachi-imports-plugin.js";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginPerfectionist from "eslint-plugin-perfectionist";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

const unusedVarsOptions = {
	args: "all",
	argsIgnorePattern: "^_",
	caughtErrors: "all",
	caughtErrorsIgnorePattern: "^_",
	destructuredArrayIgnorePattern: "^_",
	ignoreRestSiblings: true,
	varsIgnorePattern: "^_",
};

const base = tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	pluginPerfectionist.configs["recommended-natural"],
	{
		name: "tachi/base",
		files: ["**/*.{ts,tsx}"],
		plugins: {
			import: pluginImport,
			tachi: pluginTachiImports,
			"unused-imports": pluginUnusedImports,
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: {
				project: true,
			},
		},
		rules: {
			...configPrettier.rules,
			...pluginImport.flatConfigs.recommended.rules,
			...pluginImport.flatConfigs.typescript.rules,
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{
					disallowTypeAnnotations: true,
					fixStyle: "inline-type-imports",
					prefer: "type-imports",
				},
			],
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"unused-imports/no-unused-imports": "error",
			"unused-imports/no-unused-vars": ["warn", unusedVarsOptions],
			"perfectionist/sort-objects": "off",
			"perfectionist/sort-union-types": [
				"error",
				{
					type: "natural",
					groups: [
						"conditional",
						"function",
						"import",
						"intersection",
						"keyword",
						"literal",
						"named",
						"object",
						"operator",
						"tuple",
						"union",
						"nullish",
					],
				},
			],
			"perfectionist/sort-interfaces": "off",
			"perfectionist/sort-switch-case": "off",
			"arrow-body-style": "error",
			curly: "error",
			"default-param-last": "error",
			"dot-notation": "error",
			eqeqeq: "error",
			"no-array-constructor": "error",
			"no-await-in-loop": "warn",
			"no-duplicate-imports": "off",
			"import/no-duplicates": ["error", { "prefer-inline": true }],
			"no-eval": "error",
			"no-implied-eval": "error",
			"no-labels": "error",
			"no-loop-func": "error",
			"no-new-func": "error",
			"no-new-object": "error",
			"no-octal-escape": "error",
			"no-param-reassign": "off",
			"no-proto": "error",
			"no-prototype-builtins": "off",
			"no-return-await": "error",
			"no-empty-pattern": "off",
			"no-template-curly-in-string": "error",
			"no-throw-literal": "error",
			"no-unmodified-loop-condition": "error",
			"no-unused-expressions": "error",
			"no-unused-labels": "error",
			"no-useless-call": "error",
			"no-useless-concat": "error",
			"no-useless-constructor": "error",
			"no-useless-escape": "error",
			"no-useless-return": "error",
			"no-var": "error",
			"prefer-arrow-callback": "error",
			"prefer-const": "error",
			"prefer-promise-reject-errors": "error",
			"prefer-rest-params": "error",
			"prefer-template": "error",
			"quote-props": ["error", "as-needed"],
			radix: "error",
			"require-await": "warn",
			"tachi/require-unicode-regexp": "error",
			"space-before-blocks": "error",
			yoda: "error",
			// import/extensions resolves the on-disk file and compares that extension (.ts vs a
			// written .js), so it often misses redundant `.js` in TypeScript source.
			"tachi/no-redundant-js-extension": "error",
			"tachi/prefer-hash-import": "error",
			// Seems to be broken
			"import/no-unresolved": "off",
			"@typescript-eslint/no-explicit-any": "warn",
		},
		settings: {
			"import/internal-regex": "^~/",
			"import/resolver": {
				typescript: {
					alwaysTryTypes: true,
				},
			},
		},
	},
	{
		name: "tachi/test-files",
		files: ["**/*.test.ts"],
		rules: {
			"no-await-in-loop": "off",
		},
	},
);

const node = /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config} */ ({
	name: "tachi/node",
	files: ["**/*.{js,mjs,cjs,ts,tsx}"],
	languageOptions: {
		globals: {
			...globals.node,
		},
	},
});

const react = /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config} */ ({
	name: "tachi/react",
	files: ["**/*.tsx"],
	languageOptions: {
		parserOptions: {
			ecmaFeatures: {
				jsx: true,
			},
		},
		globals: {
			...globals.browser,
		},
	},
	plugins: {
		react: pluginReact,
		"react-hooks": pluginReactHooks,
		"react-refresh": pluginReactRefresh,
	},
	rules: {
		// No one cares about missing display names
		"react/display-name": ["off"],
		"react/jsx-key": ["error"],
		"react/jsx-no-comment-textnodes": ["error"],
		"react/jsx-no-duplicate-props": ["error"],
		"react/jsx-no-target-blank": ["error"],
		"react/jsx-no-undef": ["error"],
		"react/jsx-uses-vars": ["error"],
		"react/no-children-prop": ["error"],
		"react/no-danger-with-children": ["error"],
		"react/no-deprecated": ["error"],
		"react/no-direct-mutation-state": ["error"],
		"react/no-find-dom-node": ["error"],
		"react/no-is-mounted": ["error"],
		"react/no-render-return-value": ["error"],
		"react/no-string-refs": ["error"],
		// I don't believe in this made-up busywork
		"react/no-unescaped-entities": ["off"],
		"react/no-unknown-property": ["error"],
		"react/no-unsafe": ["off"],
		"react/prop-types": ["off"],
		"react/require-render-return": ["error"],
		"react/react-in-jsx-scope": ["off"],
		"react/jsx-uses-react": ["off"],
		"react-hooks/rules-of-hooks": ["error"],
		// Knowing when you're inexhaustive is very valuable, but actually being
		// exhaustive is not always what you want, in fact, we frequently don't want it.
		"react-hooks/exhaustive-deps": ["warn"],
	},
	settings: {
		react: {
			version: "detect",
		},
		"import/resolver": {
			typescript: {},
		},
	},
});

// unused (from zenith), we don't use remix. We don't even use remix in zenith either
// because it got renamed to rrv7.
const reactRemix = /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config} */ ({
	name: "tachi/react-remix",
	languageOptions: {
		// @ts-expect-error it is definitely not undefined
		parserOptions: react.languageOptions.parserOptions,
	},
	plugins: { ...react.plugins, "jsx-a11y": pluginJsxA11y },
	files: ["**/*{,.client,.server}.tsx"],
	rules: {
		...react.rules,
		...pluginJsxA11y.flatConfigs.recommended.rules,
	},
	settings: {
		...react.settings,
		formComponents: ["Form"],
		linkComponents: [
			{ linkAttribute: "to", name: "Link" },
			{ linkAttribute: "to", name: "NavLink" },
		],
	},
});

export default {
	base,
	node,
	react,
	reactRemix,
};
